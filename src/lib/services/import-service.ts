import "server-only";
import Papa from "papaparse";
import type { AppContext } from "@/lib/db";
import { today } from "@/lib/domain/dates";
import { deriveStatus } from "@/lib/domain/invoices";
import type { Customer, Invoice } from "@/lib/types";
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
