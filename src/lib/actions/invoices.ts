"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/db";
import { today } from "@/lib/domain/dates";
import { deriveStatus } from "@/lib/domain/invoices";
import { audit } from "@/lib/services/audit";
import { refreshCustomerRisk } from "@/lib/services/collection-service";
import { importInvoices, validateInvoiceCsv, type CsvValidation } from "@/lib/services/import-service";
import type { Invoice } from "@/lib/types";
import { invoiceSchema, issuesToMessage, type InvoiceCsvRow } from "@/lib/validation";
import type { FormState } from "./customers";

export async function createInvoiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = invoiceSchema.safeParse({ ...raw, paid_amount: raw.paid_amount || "0" });
  if (!parsed.success) return { error: issuesToMessage(parsed.error) };
  const ctx = await requireContext();
  const customer = await ctx.store.get("customers", parsed.data.customer_id);
  if (!customer) return { error: "customer not found" };
  const existing = await ctx.store.list("invoices", { where: { invoice_number: parsed.data.invoice_number } });
  if (existing.length) return { error: `Invoice number ${parsed.data.invoice_number} already exists` };
  const base: Invoice = {
    id: "", created_at: "", organization_id: ctx.org.id,
    customer_id: customer.id,
    invoice_number: parsed.data.invoice_number,
    invoice_date: parsed.data.invoice_date,
    due_date: parsed.data.due_date,
    currency: parsed.data.currency,
    amount: parsed.data.amount,
    paid_amount: parsed.data.paid_amount,
    status: parsed.data.status ?? "SENT",
    collection_stage: "NONE",
    assigned_user_id: ctx.user.id,
    description: parsed.data.description,
    last_reminder_stage: null,
    last_reminder_at: null,
    updated_at: new Date().toISOString(),
  };
  const { id: _i, created_at: _c, organization_id: _o, ...row } = { ...base, status: parsed.data.status === "DRAFT" ? "DRAFT" : deriveStatus(base, today()) } as Invoice;
  void _i; void _c; void _o;
  const inv = await ctx.store.insert("invoices", row);
  await audit(ctx.store, { user_id: ctx.user.id, action: "invoice.created", entity_type: "invoice", entity_id: inv.id });
  await refreshCustomerRisk(ctx, customer);
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  redirect(`/invoices/${inv.id}`);
}

export async function validateInvoiceCsvAction(text: string): Promise<CsvValidation<InvoiceCsvRow> & { newCustomers: string[]; duplicates: string[] }> {
  const ctx = await requireContext();
  const v = validateInvoiceCsv(text.slice(0, 2_000_000));
  const [customers, invoices] = await Promise.all([ctx.store.list("customers"), ctx.store.list("invoices")]);
  const names = new Set(customers.map((c) => c.company_name.trim().toLocaleLowerCase("tr")));
  const numbers = new Set(invoices.map((i) => i.invoice_number.toLocaleLowerCase("tr")));
  const newCustomers = [...new Set(v.valid.map((r) => r.data.customer.trim()).filter((n) => !names.has(n.toLocaleLowerCase("tr"))))];
  const duplicates = v.valid.map((r) => r.data.invoice_number).filter((n) => numbers.has(n.toLocaleLowerCase("tr")));
  return { ...v, newCustomers, duplicates };
}

export async function importInvoicesAction(text: string): Promise<{ ok: boolean; error?: string; imported?: number; skippedDuplicates?: number; createdCustomers?: number }> {
  try {
    const ctx = await requireContext();
    const v = validateInvoiceCsv(text.slice(0, 2_000_000));
    if (v.valid.length === 0) return { ok: false, error: "No valid rows" };
    const r = await importInvoices(ctx, v.valid.map((x) => x.data));
    for (const p of ["/invoices", "/customers", "/dashboard"]) revalidatePath(p);
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "import failed" };
  }
}
