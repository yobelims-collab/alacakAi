import "server-only";
import Papa from "papaparse";
import type { AppContext } from "@/lib/db";
import { today } from "@/lib/domain/dates";
import { deriveStatus } from "@/lib/domain/invoices";
import type { ParsedStatement } from "@/lib/domain/cari-ekstre";
import type { Customer, Invoice, Payment } from "@/lib/types";
import { bankCsvRowSchema, invoiceCsvRowSchema, type BankCsvRow, type InvoiceCsvRow } from "@/lib/validation";
import { audit } from "./audit";
import { refreshCustomerRisk } from "./collection-service";

export interface CsvValidation<T> {
  valid: { row: number; data: T }[];
  errors: { row: number; message: string }[];
  headers: string[];
}

function normaliseHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_").replace(/^﻿/, "");
}

/** Parses CSV text with Papa and validates every row with the given Zod schema. Nothing is inserted. */
export function validateCsv<T>(text: string, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }): CsvValidation<T> {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, transformHeader: normaliseHeader });
  const out: CsvValidation<T> = { valid: [], errors: [], headers: parsed.meta.fields ?? [] };
  parsed.data.forEach((raw, idx) => {
    const rowNo = idx + 2; // 1-based + header
    const result = schema.safeParse(raw);
    if (result.success) out.valid.push({ row: rowNo, data: result.data });
    else out.errors.push({ row: rowNo, message: result.error.issues.map((i) => `${String(i.path[0] ?? "")}: ${i.message}`).join("; ") });
  });
  for (const e of parsed.errors) out.errors.push({ row: (e.row ?? 0) + 2, message: e.message });
  return out;
}

export function validateInvoiceCsv(text: string): CsvValidation<InvoiceCsvRow> {
  return validateCsv(text, invoiceCsvRowSchema);
}

export function validateBankCsv(text: string): CsvValidation<BankCsvRow> {
  return validateCsv(text, bankCsvRowSchema);
}

export interface ImportInvoicesResult {
  imported: number;
  skippedDuplicates: number;
  createdCustomers: number;
}

export interface ImportInvoicesOptions {
  /** Origin recorded on the new invoices (default "CSV"). */
  source?: "CSV" | "EFATURA";
  /** invoice_number → external reference (e-Fatura ETTN) stored as `external_ref`. */
  externalRefs?: Record<string, string>;
}

/** Inserts validated invoice rows, creating customers by (case-insensitive) company name as needed. */
export async function importInvoices(ctx: AppContext, rows: InvoiceCsvRow[], options: ImportInvoicesOptions = {}): Promise<ImportInvoicesResult> {
  const source = options.source ?? "CSV";
  const externalRefs = options.externalRefs ?? {};
  const { store, org } = ctx;
  const asOf = today();
  const [customers, invoices] = await Promise.all([store.list("customers"), store.list("invoices")]);
  const byName = new Map<string, Customer>(customers.map((c) => [c.company_name.trim().toLocaleLowerCase("tr"), c]));
  const existingNumbers = new Set(invoices.map((i) => i.invoice_number.toLocaleLowerCase("tr")));
  let createdCustomers = 0;
  let skipped = 0;
  const toInsert: Omit<Invoice, "id" | "created_at" | "organization_id">[] = [];
  const touched = new Set<string>();

  for (const r of rows) {
    const num = r.invoice_number.toLocaleLowerCase("tr");
    if (existingNumbers.has(num)) {
      skipped += 1;
      continue;
    }
    existingNumbers.add(num);
    const key = r.customer.trim().toLocaleLowerCase("tr");
    let customer = byName.get(key);
    if (!customer) {
      customer = await store.insert("customers", {
        company_name: r.customer.trim(),
        contact_person: null,
        email: r.customer_email,
        phone: r.customer_phone,
        whatsapp_number: null,
        country: null,
        preferred_language: org.language,
        payment_terms_days: org.default_payment_terms_days,
        credit_limit: null,
        currency: r.currency,
        notes: null,
        account_manager_id: null,
        shipments_on_hold: false,
      });
      byName.set(key, customer);
      createdCustomers += 1;
    } else if (!customer.email && r.customer_email) {
      customer = await store.update("customers", customer.id, { email: r.customer_email });
      byName.set(key, customer);
    }
    touched.add(customer.id);
    const base: Invoice = {
      id: "",
      created_at: "",
      organization_id: org.id,
      customer_id: customer.id,
      invoice_number: r.invoice_number,
      invoice_date: r.invoice_date,
      due_date: r.due_date,
      currency: r.currency,
      amount: r.amount,
      paid_amount: Math.min(r.paid_amount, r.amount),
      status: "SENT",
      collection_stage: "NONE",
      assigned_user_id: null,
      description: null,
      last_reminder_stage: null,
      last_reminder_at: null,
      document_path: null,
      document_name: null,
      external_ref: externalRefs[r.invoice_number] ?? null,
      source,
      updated_at: new Date().toISOString(),
    };
    const { id: _i, created_at: _c, organization_id: _o, ...rest } = { ...base, status: deriveStatus(base, asOf) };
    void _i;
    void _c;
    void _o;
    toInsert.push(rest);
  }

  await store.insertMany("invoices", toInsert);
  await audit(store, { user_id: ctx.user.id, action: "invoices.import", entity_type: "invoice", details: { imported: toInsert.length, skipped, createdCustomers, source } });
  for (const id of touched) {
    const c = await store.get("customers", id);
    if (c) await refreshCustomerRisk(ctx, c);
  }
  return { imported: toInsert.length, skippedDuplicates: skipped, createdCustomers };
}

export const INVOICE_CSV_SAMPLE = `invoice_number,customer,customer_email,customer_phone,invoice_date,due_date,currency,amount,paid_amount
INV-2026-00201,ABC Teknoloji A.Ş.,muhasebe@abcteknoloji.com,+90 212 555 0101,2026-08-20,2026-09-19,EUR,18500,0
INV-2026-00202,Kuzey Gıda Ltd.,finans@kuzeygida.com.tr,+90 232 555 0202,2026-09-01,2026-10-01,TRY,145000,45000
`;

export const BANK_CSV_SAMPLE = `transaction_date,description,reference,amount,currency
2026-09-14,ABC TEKNOLOJI A.S. HAVALE,ABC-INV182,18500,EUR
2026-09-14,KUZEY GIDA LTD EFT,INV-2026-00202,100000,TRY
`;

export interface ImportStatementResult {
  createdCustomers: number;
  importedInvoices: number;
  updatedInvoices: number;
  recordedPayments: number;
  skipped: number;
  warnings: string[];
}

/**
 * Imports a parsed ERP account statement (cari ekstre): creates the customer if needed, inserts its
 * invoices with the paid amounts the statement implies, and records each receipt as a payment matched
 * to the invoice it settled (so the grade's payment-delay history is real). Re-importing a later
 * statement is safe: invoices are matched by number (paid amount only ever grows), payments are
 * de-duplicated by receipt/invoice/date/amount, and a new opening balance is skipped for a customer
 * whose earlier statement was already imported.
 */
export async function importAccountStatement(ctx: AppContext, s: ParsedStatement): Promise<ImportStatementResult> {
  const { store, org } = ctx;
  const asOf = today();
  const tr = ctx.locale === "tr";
  const key = (v: string) => v.trim().toLocaleLowerCase("tr");
  const [customers, invoices, payments] = await Promise.all([store.list("customers"), store.list("invoices"), store.list("payments")]);
  const byName = new Map(customers.map((c) => [key(c.company_name), c]));
  const byEmail = new Map(customers.filter((c) => c.email).map((c) => [key(c.email as string), c]));
  const invByNumber = new Map(invoices.map((i) => [key(i.invoice_number), i]));
  const paymentKey = (ref: string, date: string, amount: number, invoiceId: string | null) => `${key(ref)}|${date}|${amount.toFixed(2)}|${invoiceId ?? ""}`;
  const seenPayments = new Set(payments.map((p) => paymentKey(p.reference ?? "", p.payment_date, p.amount, p.matched_invoice_id)));
  const result: ImportStatementResult = { createdCustomers: 0, importedInvoices: 0, updatedInvoices: 0, recordedPayments: 0, skipped: 0, warnings: [...s.warnings] };
  const touched = new Set<string>();
  const customerFor = new Map<string, Customer>();
  const invoiceFor = new Map<string, Invoice>(); // `${customerCode}|${number}` → stored invoice
  const pending: { k: string; row: Omit<Invoice, "id" | "created_at" | "organization_id"> }[] = [];

  for (const sc of s.customers) {
    let customer = byName.get(key(sc.name)) ?? (sc.email ? byEmail.get(key(sc.email)) : undefined);
    const theirs = s.invoices.filter((i) => i.customerCode === sc.code);
    if (!customer) {
      customer = await store.insert("customers", {
        company_name: sc.name,
        contact_person: null,
        email: sc.email,
        phone: sc.phone,
        whatsapp_number: null,
        country: null,
        preferred_language: org.language,
        payment_terms_days: org.default_payment_terms_days,
        credit_limit: null,
        currency: theirs.find((i) => !i.opening)?.currency ?? org.default_currency,
        notes: [sc.code && `Cari kod: ${sc.code}`, sc.taxId && `VKN/TCKN: ${sc.taxId}`].filter(Boolean).join(" · ") || null,
        account_manager_id: null,
        shipments_on_hold: false,
      });
      byName.set(key(sc.name), customer);
      result.createdCustomers += 1;
    } else if (!customer.email && sc.email) {
      customer = await store.update("customers", customer.id, { email: sc.email });
    }
    customerFor.set(sc.code, customer);
    touched.add(customer.id);
    const hadErpHistory = invoices.some((i) => i.customer_id === customer.id && i.source === "ERP");

    for (const si of theirs) {
      const existing = invByNumber.get(key(si.number));
      if (existing) {
        if (existing.customer_id !== customer.id || existing.currency !== si.currency) {
          result.skipped += 1;
          result.warnings.push(tr ? `${si.number}: başka bir müşteride/para biriminde zaten kayıtlı, atlandı` : `${si.number}: already exists for another customer or currency, skipped`);
          continue;
        }
        invoiceFor.set(`${si.customerCode}|${si.number}`, existing);
        const paid = Math.min(existing.amount, Math.max(existing.paid_amount, si.paid));
        if (paid > existing.paid_amount + 0.005) {
          const next = { ...existing, paid_amount: paid };
          const status = deriveStatus(next, asOf);
          const updated = await store.update("invoices", existing.id, { paid_amount: paid, status, ...(status === "PAID" ? { collection_stage: "NONE" as const } : {}), updated_at: new Date().toISOString() });
          invoiceFor.set(`${si.customerCode}|${si.number}`, updated);
          result.updatedInvoices += 1;
        }
        continue;
      }
      if (si.opening && hadErpHistory) {
        result.skipped += 1;
        result.warnings.push(tr ? `${sc.name}: devir bakiyesi atlandı (önceki ekstre zaten içe aktarılmış)` : `${sc.name}: opening balance skipped (an earlier statement was already imported)`);
        continue;
      }
      const base: Invoice = {
        id: "",
        created_at: "",
        organization_id: org.id,
        customer_id: customer.id,
        invoice_number: si.number,
        invoice_date: si.issueDate,
        due_date: si.dueDate,
        currency: si.currency,
        amount: si.amount,
        paid_amount: Math.min(si.paid, si.amount),
        status: "SENT",
        collection_stage: "NONE",
        assigned_user_id: null,
        description: si.description?.slice(0, 500) ?? null,
        last_reminder_stage: null,
        last_reminder_at: null,
        document_path: null,
        document_name: null,
        external_ref: null,
        source: "ERP",
        updated_at: new Date().toISOString(),
      };
      const { id: _i, created_at: _c, organization_id: _o, ...rest } = { ...base, status: deriveStatus(base, asOf) };
      void _i;
      void _c;
      void _o;
      pending.push({ k: `${si.customerCode}|${si.number}`, row: rest });
      invByNumber.set(key(si.number), { ...base, ...rest });
    }
  }
  // One round trip per table instead of one per row (keeps big statements fast on serverless).
  const stored = pending.length ? await store.insertMany("invoices", pending.map((p) => p.row)) : [];
  stored.forEach((inv, i) => invoiceFor.set(pending[i].k, inv));
  result.importedInvoices = stored.length;

  const newPayments: Omit<Payment, "id" | "created_at" | "organization_id">[] = [];
  const recordPaymentRow = async (customerId: string, ref: string, date: string, currency: Invoice["currency"], amount: number, invoice: Invoice | null) => {
    const k = paymentKey(ref, date, amount, invoice?.id ?? null);
    if (seenPayments.has(k)) return;
    seenPayments.add(k);
    newPayments.push({
      customer_id: customerId,
      payment_date: date,
      amount,
      currency,
      reference: ref,
      matched_invoice_id: invoice?.id ?? null,
      status: invoice ? (invoice.paid_amount >= invoice.amount - 0.005 ? "MATCHED" : "PARTIAL") : "UNMATCHED",
      source: "BANK_IMPORT",
      bank_transaction_id: null,
      suggested_invoice_id: null,
      suggested_confidence: null,
      suggestion_reasons: null,
    });
  };

  for (const a of s.allocations) {
    const customer = customerFor.get(a.customerCode);
    const invoice = invoiceFor.get(`${a.customerCode}|${a.invoiceNumber}`);
    if (!customer || !invoice) continue; // e.g. its opening balance was skipped
    await recordPaymentRow(customer.id, a.reference, a.date, a.currency, a.amount, invoice);
  }
  for (const u of s.unapplied) {
    const customer = customerFor.get(u.customerCode);
    if (customer) await recordPaymentRow(customer.id, u.reference, u.date, u.currency, u.amount, null);
  }

  if (newPayments.length) await store.insertMany("payments", newPayments);
  result.recordedPayments = newPayments.length;

  await audit(store, { user_id: ctx.user.id, action: "invoices.import", entity_type: "invoice", details: { source: "ERP", imported: result.importedInvoices, updated: result.updatedInvoices, payments: result.recordedPayments, createdCustomers: result.createdCustomers } });
  for (const id of touched) {
    const c = await store.get("customers", id);
    if (c) await refreshCustomerRisk(ctx, c);
  }
  return result;
}
