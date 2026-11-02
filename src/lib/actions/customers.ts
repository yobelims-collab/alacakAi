"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/db";
import { audit } from "@/lib/services/audit";
import { refreshCustomerRisk } from "@/lib/services/collection-service";
import { denyEdit } from "@/lib/services/team-service";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/domain/roles";
import type { AppContext } from "@/lib/db";
import { customerSchema, issuesToMessage } from "@/lib/validation";

export interface FormState {
  error?: string;
  success?: boolean;
}

function fromForm(formData: FormData) {
  const o: Record<string, FormDataEntryValue | undefined> = {};
  for (const k of ["company_name", "contact_person", "email", "phone", "whatsapp_number", "country", "preferred_language", "payment_terms_days", "credit_limit", "currency", "notes", "account_manager_id"]) {
    const v = formData.get(k);
    o[k] = v === null ? undefined : v;
  }
  return o;
}

/** Only a profile of this org (with a role that can own customers) may be account manager. */
async function resolveAccountManager(ctx: AppContext, id: string | null): Promise<string | null> {
  if (!id) return null;
  const p = await ctx.store.get("profiles", id);
  return p && ACCOUNT_MANAGER_ROLES.includes(p.role) ? p.id : null;
}

export async function createCustomerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = customerSchema.safeParse(fromForm(formData));
  if (!parsed.success) return { error: issuesToMessage(parsed.error) };
  const ctx = await requireContext();
  const denied = denyEdit(ctx); if (denied) return denied;
  const customer = await ctx.store.insert("customers", { ...parsed.data, account_manager_id: await resolveAccountManager(ctx, parsed.data.account_manager_id), shipments_on_hold: false });
  await audit(ctx.store, { user_id: ctx.user.id, action: "customer.created", entity_type: "customer", entity_id: customer.id });
  await refreshCustomerRisk(ctx, customer);
  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomerAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = customerSchema.safeParse(fromForm(formData));
  if (!parsed.success) return { error: issuesToMessage(parsed.error) };
  const ctx = await requireContext();
  const denied = denyEdit(ctx); if (denied) return denied;
  const existing = await ctx.store.get("customers", id);
  if (!existing) return { error: "not found" };
  const { account_manager_id, ...rest } = parsed.data;
  await ctx.store.update("customers", id, formData.has("account_manager_id") ? { ...rest, account_manager_id: await resolveAccountManager(ctx, account_manager_id) } : rest);
  await audit(ctx.store, { user_id: ctx.user.id, action: "customer.updated", entity_type: "customer", entity_id: id });
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { success: true };
}
