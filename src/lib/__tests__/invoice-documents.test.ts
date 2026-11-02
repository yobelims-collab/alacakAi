import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { AppContext } from "@/lib/db";
import { createMemoryDatabase, MemoryStore } from "@/lib/db/memory-store";
import { demoOrganizationDefaults, seedDemoData } from "@/lib/db/demo-seed";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { loadInvoiceDocument, removeInvoiceDocument, saveInvoiceDocument } from "@/lib/services/document-service";
import { importInvoices } from "@/lib/services/import-service";

async function context(orgId = "org-doc"): Promise<AppContext> {
  const db = createMemoryDatabase();
  db.organizations.set(orgId, { id: orgId, created_at: new Date().toISOString(), ...demoOrganizationDefaults("Doc Org", { is_demo: true }) });
  const store = new MemoryStore(orgId, db);
  await seedDemoData(store, { ownerUserId: "u1" });
  const org = await store.getOrganization();
  return { user: { id: "u1", email: "u@x.test", full_name: "U", organization_id: orgId, role: "OWNER", provider: "demo" }, store, org, locale: "tr", t: dictionaries.tr, demo: true } as AppContext;
}

const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

describe("invoice documents (memory mode)", () => {
  it("stores, loads as base64 and removes a PDF", async () => {
    const ctx = await context();
    const inv = (await ctx.store.list("invoices"))[0];
    const saved = await saveInvoiceDocument(ctx, inv.id, { name: "C:\\fakepath\\Fatura 123.pdf", bytes: PDF });
    expect(saved.document_path).toBe(`${ctx.org.id}/${inv.id}.pdf`);
    expect(saved.document_name).toBe("Fatura 123.pdf");
    const doc = await loadInvoiceDocument(ctx, saved);
    expect(doc?.filename).toBe("Fatura 123.pdf");
    expect(Buffer.from(doc!.base64, "base64").toString("latin1").startsWith("%PDF")).toBe(true);
    await removeInvoiceDocument(ctx, inv.id);
    const after = await ctx.store.get("invoices", inv.id);
    expect(after?.document_path).toBeNull();
    expect(await loadInvoiceDocument(ctx, { ...saved })).toBeNull();
  });

  it("rejects non-PDF, oversized files and other organizations' invoices", async () => {
    const ctx = await context();
    const inv = (await ctx.store.list("invoices"))[0];
    await expect(saveInvoiceDocument(ctx, inv.id, { name: "x.pdf", bytes: new TextEncoder().encode("<html>") })).rejects.toThrow(/PDF/);
    const big = new Uint8Array(4 * 1024 * 1024 + 1);
    big.set(PDF.slice(0, 4));
    await expect(saveInvoiceDocument(ctx, inv.id, { name: "x.pdf", bytes: big })).rejects.toThrow(/4 MB/);
    const other = await context("org-other");
    await expect(saveInvoiceDocument(other, inv.id, { name: "x.pdf", bytes: PDF })).rejects.toThrow(/not found/);
    // A path outside the caller's org folder is never read.
    expect(await loadInvoiceDocument(other, { ...inv, document_path: `${ctx.org.id}/${inv.id}.pdf` })).toBeNull();
  });
});

describe("importInvoices options", () => {
  const row = { invoice_number: "EFT2026000000001", customer: "Yeni Alıcı A.Ş.", customer_email: null, customer_phone: null, invoice_date: "2026-10-01", due_date: "2026-10-31", currency: "TRY" as const, amount: 1000, paid_amount: 0 };

  it("defaults to CSV with no external_ref", async () => {
    const ctx = await context();
    await importInvoices(ctx, [row]);
    const [inv] = await ctx.store.list("invoices", { where: { invoice_number: row.invoice_number } });
    expect(inv.source).toBe("CSV");
    expect(inv.external_ref).toBeNull();
  });

  it("records source and ETTN for e-Fatura imports", async () => {
    const ctx = await context();
    const r = await importInvoices(ctx, [row], { source: "EFATURA", externalRefs: { [row.invoice_number]: "f47ac10b-58cc-4372-a567-0e02b2c3d479" } });
    expect(r.imported).toBe(1);
    const [inv] = await ctx.store.list("invoices", { where: { invoice_number: row.invoice_number } });
    expect(inv.source).toBe("EFATURA");
    expect(inv.external_ref).toBe("f47ac10b-58cc-4372-a567-0e02b2c3d479");
  });
});
