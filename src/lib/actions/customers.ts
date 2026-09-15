"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/db";
import { audit } from "@/lib/services/audit";
import { refreshCustomerRisk } from "@/lib/services/collection-service";
import { customerSchema, issuesToMessage } from "@/lib/validation";

export interface FormState {
  error?: string;
  success?: boolean;
}

function fromForm(formData: FormData) {
  const o: Record<string, FormDataEntryValue | undefined> = {};
  for (const k of ["company_name", "contact_person", "email", "phone", "whatsapp_number", "country", "preferred_language", "payment_terms_days", "credit_limit", "currency", "notes"]) {
    const v = formData.get(k);
    o[k] = v === null ? undefined : v;
  }
  return o;
}

export async function createCustomerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = customerSchema.safeParse(fromForm(formData));
  if (!parsed.success) return { error: issuesToMessage(parsed.error) };
  const ctx = await requireContext();
  const customer = await ctx.store.insert("customers", { ...parsed.data, account_manager_id: null });
  await audit(ctx.store, { user_id: ctx.user.id, action: "customer.created", entity_type: "customer", entity_id: customer.id });
  await refreshCustomerRisk(ctx, customer);
  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomerAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = customerSchema.safeParse(fromForm(formData));
  if (!parsed.success) return { error: issuesToMessage(parsed.error) };
  const ctx = await requireContext();
  const existing = await ctx.store.get("customers", id);
  if (!existing) return { error: "not found" };
  await ctx.store.update("customers", id, parsed.data);
  await audit(ctx.store, { user_id: ctx.user.id, action: "customer.updated", entity_type: "customer", entity_id: id });
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { success: true };
}
