import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { AppContext } from "@/lib/db";
import { createMemoryDatabase, MemoryStore } from "@/lib/db/memory-store";
import { demoOrganizationDefaults } from "@/lib/db/demo-seed";
import { parseAccountStatement } from "@/lib/domain/cari-ekstre";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { importAccountStatement } from "@/lib/services/import-service";
import { STATEMENT_XML, statementRow } from "./fixtures/cari-ekstre";

async function context(): Promise<AppContext> {
  const orgId = "org-erp";
  const db = createMemoryDatabase();
  db.organizations.set(orgId, { id: orgId, created_at: new Date().toISOString(), ...demoOrganizationDefaults("ERP Org", { is_demo: true }) });
  const store = new MemoryStore(orgId, db);
  const org = await store.getOrganization();
  return { user: { id: "u1", email: "u@x.test", full_name: "U", organization_id: orgId, role: "OWNER", provider: "demo" }, store, org, locale: "tr", t: dictionaries.tr, demo: true } as AppContext;
}

const parse = (xml: string) => {
  const r = parseAccountStatement(xml);
  if (!r.ok) throw new Error(r.error);
  return r.statement;
};

describe("importAccountStatement (memory mode)", () => {
  it("creates the customer, invoices with paid amounts and matched payments", async () => {
    const ctx = await context();
    const r = await importAccountStatement(ctx, parse(STATEMENT_XML));
    expect(r).toMatchObject({ createdCustomers: 1, importedInvoices: 8, updatedInvoices: 0, skipped: 0 });
    const [customer] = await ctx.store.list("customers");
    expect(customer).toMatchObject({ company_name: "ÖRNEK TELEKOM SRL", email: "finance@ornek.example", currency: "EUR" });
    const invoices = await ctx.store.list("invoices");
    const open = invoices.filter((i) => i.status !== "PAID");
    expect(open.map((i) => i.invoice_number)).toEqual(["CIH2026000000410"]);
    expect(invoices.every((i) => i.source === "ERP")).toBe(true);
    const payments = await ctx.store.list("payments");
    expect(payments.length).toBe(r.recordedPayments);
    expect(payments.every((p) => p.matched_invoice_id && p.status === "MATCHED")).toBe(true);
    const risk = await ctx.store.list("risk_scores", { where: { customer_id: customer.id } });
    expect(risk.length).toBe(1);
  });

  it("re-importing is idempotent and a later statement only adds what is new", async () => {
    const ctx = await context();
    await importAccountStatement(ctx, parse(STATEMENT_XML));
    const again = await importAccountStatement(ctx, parse(STATEMENT_XML));
    expect(again).toMatchObject({ createdCustomers: 0, importedInvoices: 0, updatedInvoices: 0, recordedPayments: 0 });

    const later = STATEMENT_XML.replace("</NewDataSet>", `${statementRow("DETAY", "2026-11-03", "BNK-7", "Finans", "0", "100.00", { text: "CIH2026000000410" })}</NewDataSet>`);
    const r = await importAccountStatement(ctx, parse(later));
    expect(r).toMatchObject({ importedInvoices: 0, updatedInvoices: 1, recordedPayments: 1 });
    const inv = (await ctx.store.list("invoices", { where: { invoice_number: "CIH2026000000410" } }))[0];
    expect(inv).toMatchObject({ paid_amount: 100, status: "PAID" });
    expect((await ctx.store.list("invoices")).length).toBe(8);
  });
});
