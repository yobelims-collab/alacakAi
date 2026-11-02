import type { UserRole } from "@/lib/types";

/**
 * Pure role rules for team management and write access. Used by `services/team-service.ts`
 * (server enforcement) and by pages to decide what to render. No I/O here.
 *
 * - OWNER / ADMIN: manage settings and the team, plus everything FINANCE can do.
 * - FINANCE: sees everything, approves and edits collection data.
 * - SALES: edits too, but the inbox only shows customers they are account manager of.
 * - VIEWER: read only.
 */

/** Roles that can be given to an invited colleague. OWNER is never assignable. */
export const INVITABLE_ROLES = ["ADMIN", "FINANCE", "SALES", "VIEWER"] as const satisfies readonly UserRole[];
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

/** Roles that may be picked as a customer's account manager. */
export const ACCOUNT_MANAGER_ROLES: readonly UserRole[] = ["OWNER", "ADMIN", "FINANCE", "SALES"];

export function canManage(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canInvite(role: UserRole): boolean {
  return canManage(role);
}

export function canEdit(role: UserRole): boolean {
  return role !== "VIEWER";
}

export function isInvitableRole(role: string): role is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(role);
}

export type MemberChangeError = "forbidden" | "not_found" | "owner" | "self" | "invalid_role";

/**
 * Whether `actor` may change the role of / remove `target`. Returns null when allowed.
 * `nextRole` is the requested role for a role change (omit for removal).
 */
export function memberChangeError(
  actor: { id: string; role: UserRole },
  target: { id: string; role: UserRole } | null,
  nextRole?: string,
): MemberChangeError | null {
  if (!canManage(actor.role)) return "forbidden";
  if (!target) return "not_found";
  if (target.role === "OWNER") return "owner";
  if (target.id === actor.id) return "self";
  if (nextRole !== undefined && !isInvitableRole(nextRole)) return "invalid_role";
  return null;
}
