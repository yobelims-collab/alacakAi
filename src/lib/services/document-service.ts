import "server-only";
import type { AppContext } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Invoice } from "@/lib/types";
import { audit } from "./audit";

/**
 * Invoice PDF storage. Supabase mode: private bucket `invoice-docs` at `<org id>/<invoice id>.pdf`
 * (service-role client; the org id always comes from the verified session, never from input).
 * Demo mode: bytes live in a process-local Map on globalThis, like the memory DB.
 */
export const INVOICE_DOCS_BUCKET = "invoice-docs";
export const MAX_INVOICE_DOCUMENT_BYTES = 4 * 1024 * 1024;

/** The parts of the request context the document service needs (AppContext satisfies it). */
export type DocumentContext = Pick<AppContext, "store"> & { org: { id: string }; user: { id: string } };

declare global {
  var __alacakaiInvoiceDocs: Map<string, Uint8Array> | undefined;
}

function memoryDocs(): Map<string, Uint8Array> {
  if (!globalThis.__alacakaiInvoiceDocs) globalThis.__alacakaiInvoiceDocs = new Map();
  return globalThis.__alacakaiInvoiceDocs;
}

function adminClient() {
  const client = createSupabaseAdminClient();
  if (!client) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to store invoice PDFs");
  return client;
}

function isPdf(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // "%PDF"
}

function safeFileName(name: string, fallback: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "").replace(/[\u0000-\u001f"<>|*?:]/g, "").trim().slice(0, 120);
  if (!base) return fallback;
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}

/** Only paths inside the caller's org folder are ever read or removed. */
function ownedPath(ctx: DocumentContext, invoice: Invoice): string | null {
  const p = invoice.document_path;
  if (!p || !p.startsWith(`${ctx.org.id}/`) || p.includes("..")) return null;
  return p;
}

export async function saveInvoiceDocument(ctx: DocumentContext, invoiceId: string, file: { name: string; bytes: Uint8Array }): Promise<Invoice> {
  const invoice = await ctx.store.get("invoices", invoiceId);
  if (!invoice) throw new Error("invoice not found");
  if (file.bytes.length === 0) throw new Error("empty file");
  if (file.bytes.length > MAX_INVOICE_DOCUMENT_BYTES) throw new Error("PDF must be 4 MB or smaller");
  if (!isPdf(file.bytes)) throw new Error("Only PDF files are accepted");

  const path = `${ctx.org.id}/${invoice.id}.pdf`;
  if (ctx.store.kind === "memory") {
    memoryDocs().set(path, new Uint8Array(file.bytes));
  } else {
    const { error } = await adminClient().storage.from(INVOICE_DOCS_BUCKET).upload(path, file.bytes, { contentType: "application/pdf", upsert: true });
    if (error) throw new Error(`PDF upload failed: ${error.message}`);
  }
  const name = safeFileName(file.name, `${invoice.invoice_number}.pdf`);
  const updated = await ctx.store.update("invoices", invoice.id, { document_path: path, document_name: name, updated_at: new Date().toISOString() });
  await audit(ctx.store, { user_id: ctx.user.id, action: "invoice.document_uploaded", entity_type: "invoice", entity_id: invoice.id, details: { name, bytes: file.bytes.length } });
  return updated;
}

/** Raw PDF bytes of the invoice's document, or null when there is none (or it cannot be read). */
export async function readInvoiceDocumentBytes(ctx: DocumentContext, invoice: Invoice): Promise<{ filename: string; bytes: Uint8Array } | null> {
  const path = ownedPath(ctx, invoice);
  if (!path) return null;
  const filename = invoice.document_name ?? `${invoice.invoice_number}.pdf`;
  if (ctx.store.kind === "memory") {
    const bytes = memoryDocs().get(path);
    return bytes ? { filename, bytes } : null;
  }
  const client = createSupabaseAdminClient();
  if (!client) return null;
  const { data, error } = await client.storage.from(INVOICE_DOCS_BUCKET).download(path);
  if (error || !data) {
    console.error("invoice document download failed", error?.message);
    return null;
  }
  return { filename, bytes: new Uint8Array(await data.arrayBuffer()) };
}

/** Base64 PDF for e-mail attachments. */
export async function loadInvoiceDocument(ctx: DocumentContext, invoice: Invoice): Promise<{ filename: string; base64: string } | null> {
  const doc = await readInvoiceDocumentBytes(ctx, invoice);
  return doc ? { filename: doc.filename, base64: Buffer.from(doc.bytes).toString("base64") } : null;
}

export async function removeInvoiceDocument(ctx: DocumentContext, invoiceId: string): Promise<void> {
  const invoice = await ctx.store.get("invoices", invoiceId);
  if (!invoice) throw new Error("invoice not found");
  const path = ownedPath(ctx, invoice);
  if (path) {
    if (ctx.store.kind === "memory") {
      memoryDocs().delete(path);
    } else {
      const { error } = await adminClient().storage.from(INVOICE_DOCS_BUCKET).remove([path]);
      if (error) throw new Error(`PDF removal failed: ${error.message}`);
    }
  }
  await ctx.store.update("invoices", invoice.id, { document_path: null, document_name: null, updated_at: new Date().toISOString() });
  await audit(ctx.store, { user_id: ctx.user.id, action: "invoice.document_removed", entity_type: "invoice", entity_id: invoice.id });
}
