/**
 * Excel (.xlsx / .xls) version of the ERP account statement import. ERPs export the "Cari Ekstre"
 * report to Excel in two shapes, both handled here:
 *  - the printed layout ("Cari Hareket Listesi"): a header block with "Cari Kod / Ad", "E-Mail", …
 *    then a table with Belge Tarih | Belge No | … | Vade Tarih | Açıklama | Para | Borç Tutar | Alacak Tutar | …
 *  - a raw grid whose column headers are the field names (BELGE_TARIH, BORC_TUTAR, …).
 * Columns are found by their (diacritic-insensitive) header text, so column order does not matter.
 * The *_YP / "YP …" columns (TRY equivalents) are never used for amounts.
 */
import { buildStatement, normalizeCurrency, type StatementLine, type StatementResult } from "./cari-ekstre";

export type SheetRows = unknown[][];

/** "Borç Tutar" → "borctutar", "CARI_E_MAIL" → "cariemail". */
export function normHeader(v: unknown): string {
  return String(v ?? "")
    .toLocaleLowerCase("tr")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/[ıi̇]/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]/g, "");
}

const COLUMNS = {
  date: ["belgetarih", "belgetarihi", "tarih", "islemtarihi"],
  docNo: ["belgeno", "belgenumarasi", "fisno", "evrakno"],
  code: ["carikod", "carikodu", "hesapkodu"],
  name: ["cariad", "cariadi", "cariunvan", "unvan"],
  source: ["kaynak"],
  tip: ["tip"],
  due: ["vadetarih", "vadetarihi", "vade", "borcvade"],
  avgDue: ["ortalamavade"],
  text: ["aciklama", "daciklama1", "maciklama1"],
  text2: ["daciklama2", "maciklama2", "daciklamagenis"],
  currency: ["para", "parabirimi", "belgekurkod", "kurkod", "doviz", "dovizcinsi"],
  debit: ["borctutar", "borctutari", "borc"],
  credit: ["alacaktutar", "alacaktutari", "alacak"],
  email: ["cariemail", "email", "eposta"],
  phone: ["caritel1", "telefon", "tel1"],
  taxId: ["vergino", "vkn", "tckn"],
} as const;
type ColKey = keyof typeof COLUMNS;

function headerMap(row: unknown[]): Partial<Record<ColKey, number[]>> | null {
  const cells = row.map(normHeader);
  const map: Partial<Record<ColKey, number[]>> = {};
  for (const key of Object.keys(COLUMNS) as ColKey[]) {
    const idx = cells.flatMap((c, i) => ((COLUMNS[key] as readonly string[]).includes(c) ? [i] : []));
    if (idx.length) map[key] = idx;
  }
  return map.docNo && map.debit && map.credit ? map : null;
}

const text = (v: unknown) => (v === null || v === undefined ? "" : v instanceof Date ? "" : String(v).trim());

/** Excel serial, Date, "03.11.2025", "2025-11-03T00:00:00" → "2025-11-03". */
export function cellDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  const s = text(v);
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m && m[1] !== "0001") return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

/** 1570901.67, "1.570.901,67", "1,570,901.67", "26 221,11" → number. */
export function cellAmount(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
  let s = text(v).replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  const lc = s.lastIndexOf(","), ld = s.lastIndexOf(".");
  if (lc >= 0 && ld >= 0) s = lc > ld ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (lc >= 0) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** Label cells of the printed report's header block → the value in the next non-empty cell. */
const LABELS: Record<string, "codeName" | "email" | "phone" | "tax"> = {
  carikodad: "codeName",
  carikodadi: "codeName",
  email: "email",
  eposta: "email",
  tel1: "phone",
  telefon: "phone",
  vergidairesino: "tax",
  vergino: "tax",
};

interface Party {
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  taxId: string | null;
}

function scanHeaderBlock(row: unknown[], party: Party): void {
  for (let i = 0; i < row.length; i++) {
    const label = LABELS[normHeader(row[i])];
    if (!label) continue;
    let j = i + 1;
    while (j < row.length && (text(row[j]) === "" || text(row[j]) === ":")) j++;
    const value = text(row[j]).replace(/^:\s*/, "");
    if (!value) continue;
    if (label === "codeName") {
      const m = value.match(/^(.*?)\s+-\s+(.+)$/);
      party.code = (m ? m[1] : value).trim();
      party.name = (m ? m[2] : value).trim();
      party.email = party.phone = party.taxId = null;
    } else if (label === "email" && value.includes("@")) party.email = value.toLowerCase();
    else if (label === "phone") party.phone = value;
    else if (label === "tax") party.taxId = value.replace(/^[-\s]+/, "").split(/\s+/).pop() || null;
  }
}

/** Parses the sheets of an exported statement workbook (values as returned by sheet_to_json(header:1)). */
export function parseStatementSheets(sheets: SheetRows[]): StatementResult {
  const lines: StatementLine[] = [];
  for (const rows of sheets) {
    let cols: Partial<Record<ColKey, number[]>> | null = null;
    let sectionCurrency: string | null = null;
    const party: Party = { code: "", name: "", email: null, phone: null, taxId: null };
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const header = headerMap(row);
      if (header) {
        cols = header;
        continue;
      }
      const filled = row.map(text).filter(Boolean);
      if (!cols) {
        scanHeaderBlock(row, party);
        continue;
      }
      const get = (k: ColKey) => (cols?.[k] ? row[cols[k]![0]] : undefined);
      const date = cellDate(get("date"));
      const docNo = text(get("docNo"));
      if (!date && !docNo) {
        // Currency section rows ("EUR") or a new customer's header block in multi-customer exports.
        if (filled.length === 1 && normalizeCurrency(filled[0]) && filled[0].length <= 4) sectionCurrency = filled[0];
        else scanHeaderBlock(row, party);
        continue;
      }
      const code = text(get("code")) || party.code || text(get("name"));
      const name = text(get("name")) || party.name || code;
      const source = text(get("source"));
      const tip = text(get("tip"));
      const notes = [...(cols.text ?? []), ...(cols.text2 ?? [])].map((i) => text(row[i])).filter(Boolean);
      lines.push({
        code,
        name,
        email: text(get("email")).toLowerCase() || party.email,
        phone: text(get("phone")) || party.phone,
        taxId: text(get("taxId")) || party.taxId,
        opening: tip === "BASLANGIC_DEVIR" || docNo.toLocaleUpperCase("tr") === "DEVIR" || /devir/i.test(source),
        date,
        docNo,
        source,
        text: [...new Set(notes)].join(" · "),
        dueDate: cellDate(get("due")),
        averageDueDate: cellDate(get("avgDue")),
        currencyRaw: text(get("currency")) || sectionCurrency,
        debit: cellAmount(get("debit")),
        credit: cellAmount(get("credit")),
      });
    }
  }
  if (!lines.length)
    return { ok: false, error: "Excel'de ekstre tablosu bulunamadı (Belge No, Borç Tutar, Alacak Tutar sütunları) / no statement table found (Belge No, Borç, Alacak columns)" };
  const dates = lines.map((l) => l.date).filter((d): d is string => Boolean(d)).sort();
  return { ok: true, statement: buildStatement(lines, { from: dates[0] ?? null, to: dates[dates.length - 1] ?? null }) };
}

/** Reads every sheet of an .xlsx/.xls/.ods file into row arrays (SheetJS, loaded on demand). */
export async function readWorkbook(data: ArrayBuffer | Uint8Array): Promise<SheetRows[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(data, { type: "array", cellDates: false, cellFormula: false, cellHTML: false });
  return wb.SheetNames.map((n) => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: false }));
}

export const isSpreadsheetName = (name: string) => /\.(xlsx|xlsm|xls|ods)$/i.test(name);

/** One entry point for both formats, used by the preview (browser) and the import (server). */
export async function parseStatementFile(name: string, data: ArrayBuffer | Uint8Array): Promise<StatementResult> {
  if (isSpreadsheetName(name)) {
    try {
      return parseStatementSheets(await readWorkbook(data));
    } catch {
      return { ok: false, error: "Excel dosyası okunamadı / could not read the Excel file" };
    }
  }
  const { parseAccountStatement } = await import("./cari-ekstre");
  return parseAccountStatement(new TextDecoder("utf-8").decode(data));
}
