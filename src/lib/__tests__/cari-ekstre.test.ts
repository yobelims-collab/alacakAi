import { describe, expect, it } from "vitest";
import { looksLikeAccountStatement, openByCurrency, parseAccountStatement } from "@/lib/domain/cari-ekstre";
import { STATEMENT_XML as XML, statementRow as row } from "./fixtures/cari-ekstre";


describe("cari ekstre (ERP account statement)", () => {
  it("is detected and parsed into customer, invoices and payments", () => {
    expect(looksLikeAccountStatement(XML)).toBe(true);
    expect(looksLikeAccountStatement("invoice_number,customer\n1,x")).toBe(false);
    const r = parseAccountStatement(XML);
    if (!r.ok) throw new Error(r.error);
    const s = r.statement;
    expect(s.period).toEqual({ from: "2025-11-04", to: "2026-11-04" });
    expect(s.customers).toEqual([{ code: "120 01 0001", name: "ÖRNEK TELEKOM SRL", email: "finance@ornek.example", phone: "+40 371 000 000", taxId: "1111111111" }]);

    const by = Object.fromEntries(s.invoices.map((i) => [i.number, i]));
    // Opening balance 1000 − 800 = 200, due on the average due date, paid FIFO by the two unreferenced receipts.
    const devir = s.invoices.find((i) => i.opening)!;
    expect(devir).toMatchObject({ amount: 200, paid: 200, dueDate: "2025-07-24", currency: "EUR" });
    expect(by.CIH2025000000593).toMatchObject({ amount: 500, paid: 500, issueDate: "2025-11-22", dueDate: "2026-01-21" });
    expect(by.CIH2025000000607.paid).toBe(300);
    expect(by.CIH2025000000611.paid).toBe(200); // reference matched case-insensitively ("-cih…")
    // One receipt naming two invoices is split across them.
    expect(by.CIH2026000000453.paid).toBe(70);
    expect(by.CIH2026000000460.paid).toBe(80);
    expect(by.CIH2026000000410).toMatchObject({ amount: 100, paid: 0, dueDate: "2026-11-02" });
    // USD is kept separate from EUR.
    expect(by.CIH2026000000387).toMatchObject({ currency: "USD", amount: 400, paid: 400 });
    // Kur değerleme rows, the zero purchase invoice and the zero USD devir are ignored; no invoice created for them.
    expect(by["GM 108781"]).toBeUndefined();
    expect(by["CRH-03335"]).toBeUndefined();
    expect(s.invoices).toHaveLength(8);
    expect(s.ignoredRows).toBe(4);

    expect(s.allocations.filter((a) => a.method === "reference").map((a) => a.invoiceNumber)).toEqual([
      "CIH2025000000593",
      "CIH2025000000607",
      "CIH2025000000611",
      "CIH2026000000453",
      "CIH2026000000460",
      "CIH2026000000387",
    ]);
    expect(s.unapplied).toHaveLength(0);
    expect(openByCurrency(s.invoices)).toEqual({ EUR: 100, USD: 0 });
  });

  it("keeps advance payments and rejects unsafe or foreign input", () => {
    const extra = XML.replace("</NewDataSet>", `${row("DETAY", "2026-10-30", "BNK-9", "Finans", "0", "130.00")}</NewDataSet>`);
    const r = parseAccountStatement(extra);
    if (!r.ok) throw new Error(r.error);
    expect(r.statement.unapplied).toMatchObject([{ reference: "BNK-9", amount: 30 }]);
    expect(openByCurrency(r.statement.invoices).EUR).toBe(0);

    expect(parseAccountStatement('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><NewDataSet/>').ok).toBe(false);
    expect(parseAccountStatement("<NewDataSet><RAPOR_PARAM/></NewDataSet>").ok).toBe(false);
    expect(parseAccountStatement("a,b,c").ok).toBe(false);
  });
});
