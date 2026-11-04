import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { cellAmount, cellDate, parseStatementFile, parseStatementSheets } from "@/lib/domain/cari-ekstre-excel";
import { openByCurrency } from "@/lib/domain/cari-ekstre";

/** The printed "Cari Hareket Listesi" layout as ERPs export it to Excel (synthetic data). */
const PRINTED: unknown[][] = [
  [null, null, null, "Cari Hareket Listesi"],
  ["Firma", ":", "01 | SATICI A.Ş."],
  ["Cari Kod / Ad", ":", "120 01 0001 - ÖRNEK TELEKOM SRL", null, null, "Adres", "Bükreş", null, "Tel -1", ":", "+40 371 000 000"],
  ["Vergi Dairesi / No", ":", "- 1111111111", null, null, null, null, null, "E-Mail", ":", "Finance@ornek.example"],
  ["Belge Tarih", "Belge No", "Cari Kod", "Cari Ad", "Kaynak", "Vade Tarih", "Açıklama", "Para", "Borc Tutar", "Alacak Tutar", "Bakiye Tutar", "B/A", "YP Borc Tutar", "YP Alacak Tutar"],
  ["EUR"],
  ["03.11.2025", "DEVIR", "120 01 0001", "ÖRNEK TELEKOM SRL", null, "08.12.2023", null, "EUR", "1.000,00", "800,00", "200,00", "B", "47.768.761,13", "44.957.148,07"],
  ["05.11.2025", "BNK-1", "120 01 0001", "ÖRNEK TELEKOM SRL", "Finans", "05.11.2025", "Ref: 20251104EBG00938", "EUR", "0,00", "200,00", "0,00", "B", "0,00", "9.000,00"],
  ["22.11.2025", "CIH2025000000593", "120 01 0001", "ÖRNEK TELEKOM SRL", "Fatura", "21.01.2026", null, "EUR", "500,00", "0,00", "500,00", "B", "1.002.019,67", "0,00"],
  ["24.11.2025", "CIH2025000000593", "120 01 0001", "ÖRNEK TELEKOM SRL", "MuhasebeKurDeğerleme", "21.01.2026", "fatura ihraç tarihi farkı", "EUR", "0,00", "0,00", "500,00", "B", "0,00", "0,01"],
  ["21.01.2026", "BNK-2", "120 01 0001", "ÖRNEK TELEKOM SRL", "Finans", "21.01.2026", "CIH2025000000593", "EUR", "0,00", "300,00", "200,00", "B", "0,00", "15.000,00"],
  [null, null, null, null, null, null, null, null, "Toplam", "1.300,00", "1.300,00"],
];

describe("cari ekstre from Excel", () => {
  it("parses cell values in Turkish and Excel formats", () => {
    expect(cellDate("03.11.2025")).toBe("2025-11-03");
    expect(cellDate(45964)).toBe("2025-11-03");
    expect(cellDate("2026-01-21T00:00:00+03:00")).toBe("2026-01-21");
    expect(cellDate("0001-01-01T00:00:00")).toBeNull();
    expect(cellAmount("1.570.901,67")).toBe(1570901.67);
    expect(cellAmount("1,570,901.67")).toBe(1570901.67);
    expect(cellAmount("26 221,11 €")).toBe(26221.11);
    expect(cellAmount("1.000")).toBe(1000);
    expect(cellAmount(12.345)).toBe(12.35);
  });

  it("reads the printed layout: header block, opening balance, receipts, ignores YP and total rows", () => {
    const r = parseStatementSheets([PRINTED]);
    if (!r.ok) throw new Error(r.error);
    const s = r.statement;
    expect(s.customers).toEqual([{ code: "120 01 0001", name: "ÖRNEK TELEKOM SRL", email: "finance@ornek.example", phone: "+40 371 000 000", taxId: "1111111111" }]);
    const devir = s.invoices.find((i) => i.opening)!;
    expect(devir).toMatchObject({ amount: 200, paid: 200, dueDate: "2023-12-08" });
    const inv = s.invoices.find((i) => i.number === "CIH2025000000593")!;
    expect(inv).toMatchObject({ amount: 500, paid: 300, dueDate: "2026-01-21", currency: "EUR" });
    expect(openByCurrency(s.invoices)).toEqual({ EUR: 200 });
    expect(s.period).toEqual({ from: "2025-11-03", to: "2026-01-21" });
  });

  it("round-trips through a real .xlsx file, including a raw field-name grid", async () => {
    const raw = [
      ["CARI_KOD", "CARI_AD", "CARI_E_MAIL", "TIP", "BELGE_TARIH", "BELGE_NO", "KAYNAK", "BORC_VADE", "BELGE_KUR_KOD", "BORC_TUTAR", "ALACAK_TUTAR", "BORC_TUTAR_YP"],
      ["C1", "Kuzey Gıda", "elif@kuzey.example", "DETAY", new Date(2026, 8, 3), "CIH2026000000410", "Fatura", new Date(2026, 10, 2), "TL", 10925.45, 0, 999],
      ["C1", "Kuzey Gıda", "elif@kuzey.example", "DETAY", new Date(2026, 9, 28), "BNK-35221", "Finans", null, "TL", 0, 925.45, 0],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(raw), "Ekstre");
    const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const r = await parseStatementFile("ekstre.xlsx", bytes);
    if (!r.ok) throw new Error(r.error);
    expect(r.statement.invoices).toMatchObject([{ number: "CIH2026000000410", currency: "TRY", amount: 10925.45, paid: 925.45, issueDate: "2026-09-03", dueDate: "2026-11-02" }]);
    expect(r.statement.customers[0]).toMatchObject({ name: "Kuzey Gıda", email: "elif@kuzey.example" });

    const bad = await parseStatementFile("x.xlsx", new TextEncoder().encode("not a workbook at all"));
    expect(bad.ok).toBe(false);
  });
});
