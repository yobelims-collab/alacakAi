"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "@/lib/db";
import { INVITABLE_ROLES } from "@/lib/domain/roles";
import { inviteMember, removeMember, updateMemberRole } from "@/lib/services/team-service";
import { issuesToMessage } from "@/lib/validation";
import type { ActionResult } from "./collection";

const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  full_name: z.string().trim().min(2).max(120),
  role: z.enum(INVITABLE_ROLES),
});

export interface InviteState {
  error?: string;
  /** Set after a successful invite; `tempPassword` only in demo mode (no email is sent there). */
  invited?: { email: string; mode: "email" | "demo"; tempPassword?: string; at: number };
}

const message = (e: unknown) => (e instanceof Error ? e.message : "Unexpected error");

export async function inviteMemberAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const parsed = inviteMemberSchema.safeParse({ email: formData.get("email"), full_name: formData.get("full_name"), role: formData.get("role") });
  if (!parsed.success) return { error: issuesToMessage(parsed.error) };
  const ctx = await requireContext();
  try {
    const r = await inviteMember(ctx, parsed.data);
    revalidatePath("/settings/users");
    return { invited: { email: r.email, mode: r.mode, tempPassword: r.mode === "demo" ? r.tempPassword : undefined, at: Date.now() } };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function updateMemberRoleAction(profileId: string, role: string): Promise<ActionResult> {
  try {
    const id = z.string().min(1).parse(profileId);
    const next = z.enum(INVITABLE_ROLES).parse(role);
    const ctx = await requireContext();
    await updateMemberRole(ctx, id, next);
    revalidatePath("/settings/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function removeMemberAction(profileId: string): Promise<ActionResult> {
  try {
    const id = z.string().min(1).parse(profileId);
    const ctx = await requireContext();
    await removeMember(ctx, id);
    revalidatePath("/settings/users");
    revalidatePath("/customers", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
