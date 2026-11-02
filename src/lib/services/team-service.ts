import "server-only";
import { randomInt } from "node:crypto";
import type { AppContext } from "@/lib/db";
import { getMemoryDatabase } from "@/lib/db/memory-store";
import { newId } from "@/lib/db/store";
import { canEdit, canInvite, canManage, isInvitableRole, memberChangeError, type InvitableRole, type MemberChangeError } from "@/lib/domain/roles";
import { env, isDemoMode } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";
import { audit } from "./audit";

/**
 * Team management: invite colleagues, change their role, remove them.
 *
 * Authorization is checked here in code (OWNER/ADMIN only, never the OWNER or yourself).
 * In Supabase mode the `profiles` writes then go through the service-role (admin) client:
 * `profiles` deliberately has no insert policy and only a self-update policy for users, and we
 * keep it that way instead of adding an "admins may update org profiles" RLS policy. Every admin
 * query is additionally scoped with `.eq("organization_id", ctx.org.id)`.
 */

type Ctx = Pick<AppContext, "user" | "store" | "org">;

const MSG = {
  forbidden: "Bu işlem için yetkiniz yok / you are not allowed to do this",
  viewer: "İzleyici rolü yalnızca görüntüleyebilir / viewers have read-only access",
  manage: "Yalnızca sahip veya yöneticiler yapabilir / only owners and admins can do this",
  invalidRole: "Geçersiz rol / invalid role",
  notFound: "Kullanıcı bulunamadı / member not found",
  owner: "Şirket sahibi değiştirilemez veya çıkarılamaz / the owner cannot be changed or removed",
  self: "Kendi rolünüzü değiştiremez veya kendinizi çıkaramazsınız / you cannot change or remove yourself",
  alreadyMember: "Bu e-posta zaten ekipte / this email is already a team member",
  otherOrg: "Bu e-posta başka bir şirkete bağlı / this email belongs to another company",
  alreadyRegistered: "Bu e-posta zaten kayıtlı / this email is already registered",
  noServiceRole: "Davet göndermek için sunucuda SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı / SUPABASE_SERVICE_ROLE_KEY is required to invite and manage members",
} as const;

const CHANGE_MSG: Record<MemberChangeError, string> = {
  forbidden: MSG.manage,
  not_found: MSG.notFound,
  owner: MSG.owner,
  self: MSG.self,
  invalid_role: MSG.invalidRole,
};

/** Throws unless the user may change data (everyone except VIEWER). */
export function assertCanEdit(ctx: Pick<AppContext, "user">): void {
  if (!canEdit(ctx.user.role)) throw new Error(MSG.viewer);
}

/** Throws unless the user is OWNER or ADMIN (settings, team). */
export function assertCanManage(ctx: Pick<AppContext, "user">): void {
  if (!canManage(ctx.user.role)) throw new Error(MSG.manage);
}

/** Non-throwing variants for `useActionState` actions: return `{ error }` or null. */
export function denyEdit(ctx: Pick<AppContext, "user">): { error: string } | null {
  return canEdit(ctx.user.role) ? null : { error: MSG.viewer };
}

export function denyManage(ctx: Pick<AppContext, "user">): { error: string } | null {
  return canManage(ctx.user.role) ? null : { error: MSG.manage };
}

function adminClient() {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error(MSG.noServiceRole);
  return admin;
}

const ALPHANUM = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function tempPassword(length = 10): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHANUM[randomInt(ALPHANUM.length)];
  return out;
}

export type InviteResult = { mode: "email"; email: string } | { mode: "demo"; email: string; tempPassword: string };

export async function inviteMember(ctx: Ctx, input: { email: string; full_name: string; role: InvitableRole }): Promise<InviteResult> {
  if (!canInvite(ctx.user.role)) throw new Error(MSG.manage);
  if (!isInvitableRole(input.role)) throw new Error(MSG.invalidRole);
  const email = input.email.trim().toLowerCase();
  const full_name = input.full_name.trim();
  const role: UserRole = input.role;

  const members = await ctx.store.list("profiles");
  if (members.some((p) => p.email.toLowerCase() === email)) throw new Error(MSG.alreadyMember);

  let result: InviteResult;
  let profileId: string;

  if (isDemoMode()) {
    const db = getMemoryDatabase();
    const elsewhere = (db.tables.profiles as Profile[]).find((p) => p.email.toLowerCase() === email && p.organization_id !== ctx.org.id);
    if (elsewhere) throw new Error(MSG.otherOrg);
    if (db.users.has(email)) throw new Error(MSG.alreadyRegistered);
    profileId = newId();
    const password = tempPassword();
    db.users.set(email, { id: profileId, email, password, full_name });
    try {
      await ctx.store.insert("profiles", { id: profileId, email, full_name, role });
    } catch (err) {
      db.users.delete(email);
      throw err;
    }
    result = { mode: "demo", email, tempPassword: password };
  } else {
    const admin = adminClient();
    const { data: existing, error: lookupError } = await admin.from("profiles").select("id, organization_id").eq("email", email).limit(1);
    if (lookupError) throw new Error(`profiles: ${lookupError.message}`);
    if (existing && existing.length > 0) throw new Error(existing[0].organization_id === ctx.org.id ? MSG.alreadyMember : MSG.otherOrg);

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name }, redirectTo: `${env.appUrl}/set-password` });
    if (error || !data.user) throw new Error(error?.message ?? "invite failed");
    profileId = data.user.id;
    const { error: insertError } = await admin.from("profiles").insert({ id: profileId, organization_id: ctx.org.id, email, full_name, role });
    if (insertError) {
      // Do not leave an orphaned auth user that could later sign up into another org unexpectedly.
      await admin.auth.admin.deleteUser(profileId).catch(() => undefined);
      throw new Error(`profiles: ${insertError.message}`);
    }
    result = { mode: "email", email };
  }

  await audit(ctx.store, { user_id: ctx.user.id, action: "team.invited", entity_type: "profile", entity_id: profileId, details: { email, role, mode: result.mode } });
  return result;
}

export async function updateMemberRole(ctx: Ctx, profileId: string, role: string): Promise<Profile> {
  const target = await ctx.store.get("profiles", profileId);
  const problem = memberChangeError(ctx.user, target, role);
  if (problem || !target || !isInvitableRole(role)) throw new Error(CHANGE_MSG[problem ?? "invalid_role"]);

  let updated: Profile;
  if (isDemoMode()) {
    updated = await ctx.store.update("profiles", profileId, { role });
  } else {
    const { data, error } = await adminClient()
      .from("profiles")
      .update({ role })
      .eq("id", profileId)
      .eq("organization_id", ctx.org.id)
      .select("*")
      .single();
    if (error) throw new Error(`profiles: ${error.message}`);
    updated = data as Profile;
  }
  await audit(ctx.store, { user_id: ctx.user.id, action: "team.role_changed", entity_type: "profile", entity_id: profileId, details: { from: target.role, to: role } });
  return updated;
}

export async function removeMember(ctx: Ctx, profileId: string): Promise<void> {
  const target = await ctx.store.get("profiles", profileId);
  const problem = memberChangeError(ctx.user, target);
  if (problem || !target) throw new Error(CHANGE_MSG[problem ?? "not_found"]);

  // Customers they owned go back to "no account manager" (finance sees them anyway).
  const owned = await ctx.store.list("customers", { where: { account_manager_id: profileId } });
  for (const c of owned) await ctx.store.update("customers", c.id, { account_manager_id: null });

  if (isDemoMode()) {
    await ctx.store.remove("profiles", profileId);
  } else {
    const { error } = await adminClient().from("profiles").delete().eq("id", profileId).eq("organization_id", ctx.org.id);
    if (error) throw new Error(`profiles: ${error.message}`);
  }
  await audit(ctx.store, { user_id: ctx.user.id, action: "team.removed", entity_type: "profile", entity_id: profileId, details: { email: target.email, role: target.role, customers_unassigned: owned.length } });
}
