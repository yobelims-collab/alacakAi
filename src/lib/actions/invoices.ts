"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/db";
import { assertCanEdit, denyEdit } from "@/lib/services/team-service";
import { today } from "@/lib/domain/dates";
import { deriveStatus } from "@/lib/domain/invoices";
import { audit } from "@/lib/services/audit";
import { refreshCustomerRisk } from "@/lib/services/collection-service";
import { importAccountStatement, importInvoices, validateInvoiceCsv, type CsvValidation } from "@/lib/services/import-service";
import { parseStatementFile } from "@/lib/domain/cari-ekstre-excel";
import type { Invoice } from "@/lib/types";
import { invoiceSchema, issuesToMessage, type InvoiceCsvRow } from "@/lib/validation";
import type { FormState } from "./customers";

export async function createInvoiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = invoiceSchema.safeParse({ ...raw, paid_amount: raw.paid_amount || "0" });
  if (!parsed.success) return { error: issuesToMessage(parsed.error) };
  const ctx = await requireContext();
  const denied = denyEdit(ctx); if (denied) return denied;
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
    document_path: null,
    document_name: null,
    external_ref: null,
    source: "MANUAL",
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
    assertCanEdit(ctx);
    const v = validateInvoiceCsv(text.slice(0, 2_000_000));
    if (v.valid.length === 0) return { ok: false, error: "No valid rows" };
    const r = await importInvoices(ctx, v.valid.map((x) => x.data));
    for (const p of ["/invoices", "/customers", "/dashboard"]) revalidatePath(p);
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "import failed" };
  }
}

// ---------------------------------------------------------------------------
// e-Fatura (UBL-TR XML) import and invoice PDF documents.
// Imports kept here (hoisted by the module system) so the block above stays untouched.
// ---------------------------------------------------------------------------
import { z } from "zod";
import { addDays } from "@/lib/domain/dates";
import { parseEFatura } from "@/lib/domain/efatura";
import { MAX_INVOICE_DOCUMENT_BYTES, removeInvoiceDocument, saveInvoiceDocument } from "@/lib/services/document-service";
import type { Customer } from "@/lib/types";
import { invoiceCsvRowSchema } from "@/lib/validation";

const EFATURA_MAX_FILES = 200;
const EFATURA_MAX_FILE_BYTES = 2 * 1024 * 1024;
const efaturaFilesSchema = z.array(z.object({ name: z.string().max(255), xml: z.string() })).min(1).max(EFATURA_MAX_FILES);

export interface EFaturaFileResult {
  name: string;
  status: "ok" | "skipped" | "error";
  message: string | null;
  invoiceNumber: string | null;
}

export interface EFaturaImportResult {
  ok: boolean;
  error?: string;
  results: EFaturaFileResult[];
  imported: number;
  skipped: number;
  failed: number;
  createdCustomers: number;
}

export async function importEFaturaAction(files: { name: string; xml: string }[]): Promise<EFaturaImportResult> {
  const empty = { results: [], imported: 0, skipped: 0, failed: 0, createdCustomers: 0 };
  const parsedInput = efaturaFilesSchema.safeParse(files);
  if (!parsedInput.success) return { ok: false, error: `1–${EFATURA_MAX_FILES} XML files expected`, ...empty };
  try {
    const ctx = await requireContext();
    assertCanEdit(ctx);
    const tr = ctx.locale === "tr";
    const [customers, invoices] = await Promise.all([ctx.store.list("customers"), ctx.store.list("invoices")]);
    const key = (s: string) => s.trim().toLocaleLowerCase("tr");
    const byName = new Map<string, Customer>(customers.map((c) => [key(c.company_name), c]));
    const byEmail = new Map<string, Customer>(customers.filter((c) => c.email).map((c) => [key(c.email as string), c]));
    const refs = new Set(invoices.map((i) => i.external_ref).filter((r): r is string => Boolean(r)).map(key));
    const numbers = new Set(invoices.map((i) => key(i.invoice_number)));

    const results: EFaturaFileResult[] = [];
    const rows: InvoiceCsvRow[] = [];
    const externalRefs: Record<string, string> = {};

    for (const f of parsedInput.data) {
      const name = f.name || "invoice.xml";
      if (Buffer.byteLength(f.xml, "utf8") > EFATURA_MAX_FILE_BYTES) {
        results.push({ name, status: "error", message: tr ? "Dosya 2 MB sınırını aşıyor" : "File exceeds the 2 MB limit", invoiceNumber: null });
        continue;
      }
      const p = parseEFatura(f.xml);
      if (!p.ok) {
        results.push({ name, status: "error", message: p.error, invoiceNumber: null });
        continue;
      }
      const inv = p.invoice;
      if ((inv.ettn && refs.has(key(inv.ettn))) || numbers.has(key(inv.invoiceNumber))) {
        results.push({ name, status: "skipped", message: tr ? "Bu fatura zaten kayıtlı (ETTN veya fatura no)" : "Already imported (ETTN or invoice number)", invoiceNumber: inv.invoiceNumber });
        continue;
      }
      const customer = byName.get(key(inv.buyerName)) ?? (inv.buyerEmail ? byEmail.get(key(inv.buyerEmail)) : undefined);
      const dueDate = inv.dueDate ?? addDays(inv.issueDate, customer?.payment_terms_days ?? ctx.org.default_payment_terms_days);
      const row = invoiceCsvRowSchema.safeParse({
        invoice_number: inv.invoiceNumber,
        customer: customer?.company_name ?? inv.buyerName,
        customer_email: inv.buyerEmail ?? "",
        customer_phone: inv.buyerPhone ?? "",
        invoice_date: inv.issueDate,
        due_date: dueDate,
        currency: inv.currency,
        amount: inv.amount,
        paid_amount: 0,
      });
      if (!row.success) {
        results.push({ name, status: "error", message: issuesToMessage(row.error), invoiceNumber: inv.invoiceNumber });
        continue;
      }
      numbers.add(key(inv.invoiceNumber));
      if (inv.ettn) {
        refs.add(key(inv.ettn));
        externalRefs[row.data.invoice_number] = inv.ettn;
      }
      rows.push(row.data);
      results.push({ name, status: "ok", message: null, invoiceNumber: inv.invoiceNumber });
    }

    let createdCustomers = 0;
    let imported = 0;
    if (rows.length) {
      const r = await importInvoices(ctx, rows, { source: "EFATURA", externalRefs });
      createdCustomers = r.createdCustomers;
      imported = r.imported;
      for (const p of ["/invoices", "/customers", "/dashboard"]) revalidatePath(p);
    }
    return {
      ok: true,
      results,
      imported,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "error").length,
      createdCustomers,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "import failed", ...empty };
  }
}

export async function uploadInvoiceDocumentAction(formData: FormData): Promise<{ ok: boolean; error?: string; data?: { name: string } }> {
  const invoiceId = z.string().min(1).max(64).safeParse(formData.get("invoiceId"));
  const file = formData.get("file");
  if (!invoiceId.success) return { ok: false, error: "invoiceId is required" };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "PDF file is required" };
  if (file.size > MAX_INVOICE_DOCUMENT_BYTES) return { ok: false, error: "PDF must be 4 MB or smaller" };
  try {
    const ctx = await requireContext();
    assertCanEdit(ctx);
    const inv = await saveInvoiceDocument(ctx, invoiceId.data, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    revalidatePath(`/invoices/${invoiceId.data}`);
    return { ok: true, data: { name: inv.document_name ?? file.name } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "upload failed" };
  }
}

export async function removeInvoiceDocumentAction(invoiceId: string): Promise<{ ok: boolean; error?: string }> {
  const id = z.string().min(1).max(64).safeParse(invoiceId);
  if (!id.success) return { ok: false, error: "invoiceId is required" };
  try {
    const ctx = await requireContext();
    assertCanEdit(ctx);
    await removeInvoiceDocument(ctx, id.data);
    revalidatePath(`/invoices/${id.data}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "remove failed" };
  }
}

export interface StatementImportActionResult {
  ok: boolean;
  error?: string;
  data?: Awaited<ReturnType<typeof importAccountStatement>>;
}

/** Imports an ERP account statement file (cari ekstre XML or Excel). The client previews it; the server re-parses it. */
export async function importAccountStatementAction(formData: FormData): Promise<StatementImportActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Dosya gerekli / file is required" };
  if (file.size > 4 * 1024 * 1024) return { ok: false, error: "Dosya en fazla 4 MB olabilir / file must be 4 MB or smaller" };
  try {
    const ctx = await requireContext();
    assertCanEdit(ctx);
    const parsed = await parseStatementFile(file.name, new Uint8Array(await file.arrayBuffer()));
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const data = await importAccountStatement(ctx, parsed.statement);
    for (const p of ["/invoices", "/customers", "/payments", "/dashboard", "/inbox"]) revalidatePath(p);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "import failed" };
  }
}
