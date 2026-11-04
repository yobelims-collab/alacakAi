/**
 * Parser for ERP "cari hesap ekstresi" XML exports (a .NET DataSet: <NewDataSet> with repeated
 * <CARI_EKSTRE> rows — the format Netsis/Logo-style ERPs produce). Pure and side-effect free, runs in
 * the browser (preview) and on the server (import). DOCTYPE/ENTITY declarations are rejected.
 *
 * Row semantics:
 *  - TIP=BASLANGIC_DEVIR             → opening balance (debit − credit) per currency
 *  - BORC_TUTAR > 0                  → a debit: an invoice (BELGE_NO = invoice number)
 *  - ALACAK_TUTAR > 0                → a credit: a payment (bank receipt) or credit note
 *  - both 0 (kur değerleme, bedelsiz purchase lines) → ignored; they only move the TRY equivalent
 * Amounts are taken in the document currency (BORC_TUTAR / ALACAK_TUTAR, not the *_YP TRY values).
 *
 * Credits are applied to the invoices named in their description first (bank transfers usually
 * quote "CIH2026000000123"), then to the oldest open debts (FIFO by due date), like an accountant
 * closing the ekstre.
 */
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { CURRENCIES, type Currency } from "@/lib/types";

export interface StatementCustomer {
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  taxId: string | null;
}

export interface StatementInvoice {
  customerCode: string;
  number: string;
  issueDate: string;
  dueDate: string;
  currency: Currency;
  amount: number;
  /** Paid according to this statement's credits. */
  paid: number;
  /** True for the synthetic "opening balance" debt carried from the previous period. */
  opening: boolean;
  description: string | null;
}

export interface StatementAllocation {
  customerCode: string;
  invoiceNumber: string;
  /** Receipt document number, e.g. BNK-31501. */
  reference: string;
  date: string;
  currency: Currency;
  amount: number;
  /** "reference" when the bank text named the invoice, "fifo" otherwise. */
  method: "reference" | "fifo";
}

export interface StatementCredit {
  customerCode: string;
  reference: string;
  date: string;
  currency: Currency;
  amount: number;
  description: string;
}

export interface ParsedStatement {
  customers: StatementCustomer[];
  invoices: StatementInvoice[];
  allocations: StatementAllocation[];
  /** Credits left over after every debt is covered (advance payments). */
  unapplied: StatementCredit[];
  /** Period from the report parameters, when present. */
  period: { from: string | null; to: string | null };
  ignoredRows: number;
  warnings: string[];
}

export type StatementResult = { ok: true; statement: ParsedStatement } | { ok: false; error: string };

type Node = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => name === "CARI_EKSTRE",
});

/** Cheap check used to route a pasted/uploaded file to this importer. */
export function looksLikeAccountStatement(text: string): boolean {
  const head = text.slice(0, 200_000);
  return /<NewDataSet[\s>]/.test(head) && /<CARI_EKSTRE[\s>]/.test(head);
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const num = (v: unknown): number => {
  const n = Number(str(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** "2026-01-21T00:00:00+03:00" → "2026-01-21"; the .NET "0001-01-01" null date → null. */
function day(v: unknown): string | null {
  const m = str(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m || m[1] === "0001") return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

const fold = (s: string) => s.replace(/[ıİ]/g, "i").toUpperCase();

/** One ledger line, independent of the file format it came from. */
export interface StatementLine {
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  /** True for the opening-balance (devir) line. */
  opening: boolean;
  date: string | null;
  docNo: string;
  /** KAYNAK column (Fatura, Finans, MuhasebeKurDeğerleme…), informational. */
  source: string;
  text: string;
  dueDate: string | null;
  averageDueDate: string | null;
  /** Raw currency code from the file (EUR, TL…); null when the line has none. */
  currencyRaw: string | null;
  debit: number;
  credit: number;
}

export function normalizeCurrency(raw: string | null | undefined): Currency | null {
  const r = (raw ?? "").trim().toUpperCase() || "TRY";
  const c = r === "TL" || r === "YTL" || r === "TRL" || r === "₺" ? "TRY" : r === "€" ? "EUR" : r === "$" ? "USD" : r;
  return (CURRENCIES as string[]).includes(c) ? (c as Currency) : null;
}

export function parseAccountStatement(xml: string): StatementResult {
  const src = xml.replace(/^\uFEFF/, "").trim();
  if (!src.startsWith("<")) return { ok: false, error: "XML bekleniyor / XML expected" };
  if (/<!DOCTYPE|<!ENTITY/i.test(src)) return { ok: false, error: "DOCTYPE/ENTITY bildirimleri desteklenmiyor / DOCTYPE is not allowed" };
  const valid = XMLValidator.validate(src);
  if (valid !== true) return { ok: false, error: `Geçersiz XML / invalid XML: ${valid.err.msg} (line ${valid.err.line})` };

  let doc: Node;
  try {
    doc = parser.parse(src) as Node;
  } catch {
    return { ok: false, error: "XML okunamadı / could not read XML" };
  }
  const root = doc.NewDataSet as Node | undefined;
  const rows = (root?.CARI_EKSTRE as Node[] | undefined) ?? [];
  if (!root || rows.length === 0) return { ok: false, error: "Cari ekstre satırı bulunamadı (CARI_EKSTRE) / no account statement rows found" };
  const param = (root.RAPOR_PARAM as Node | undefined) ?? {};
  const lines: StatementLine[] = rows.map((row) => ({
    code: str(row.CARI_KOD) || str(row.CARI_AD),
    name: str(row.CARI_AD),
    email: str(row.CARI_E_MAIL).toLowerCase() || null,
    phone: str(row.CARI_TEL_1) || null,
    taxId: str(row.VERGI_NO) || str(row.TCKN) || null,
    opening: str(row.TIP) === "BASLANGIC_DEVIR",
    date: day(row.BELGE_TARIH),
    docNo: str(row.BELGE_NO),
    source: str(row.KAYNAK),
    text: [row.D_ACIKLAMA_1, row.D_ACIKLAMA_2, row.M_ACIKLAMA_1, row.M_ACIKLAMA_2].map(str).filter(Boolean).join(" · "),
    dueDate: day(row.BORC_VADE),
    averageDueDate: day(row.ORTALAMA_VADE),
    currencyRaw: str(row.BELGE_KUR_KOD) || str(row.KUR_KOD) || null,
    debit: round2(num(row.BORC_TUTAR)),
    credit: round2(num(row.ALACAK_TUTAR)),
  }));
  return { ok: true, statement: buildStatement(lines, { from: day(param.RAPOR_BAS_TARIH), to: day(param.RAPOR_BIT_TARIH) }) };
}

/** Turns ledger lines (from XML or Excel) into invoices, credits and allocations. */
export function buildStatement(lines: StatementLine[], period: ParsedStatement["period"]): ParsedStatement {
  const warnings: string[] = [];
  const customers = new Map<string, StatementCustomer>();
  const invoices: StatementInvoice[] = [];
  const byNumber = new Map<string, StatementInvoice>();
  const credits: StatementCredit[] = [];
  let ignored = 0;

  for (const row of lines) {
    const { code, name, debit, credit, text, docNo, date } = row;
    if (!code || !name) {
      ignored += 1;
      continue;
    }
    const known = customers.get(code);
    if (!known) customers.set(code, { code, name, email: row.email, phone: row.phone, taxId: row.taxId });
    else {
      known.email ??= row.email;
      known.phone ??= row.phone;
      known.taxId ??= row.taxId;
    }
    const currency = normalizeCurrency(row.currencyRaw);

    if (!currency) {
      if (debit || credit) warnings.push(`${docNo}: para birimi desteklenmiyor / unsupported currency ${row.currencyRaw}`);
      ignored += 1;
      continue;
    }
    if (!date) {
      ignored += 1;
      continue;
    }

    if (row.opening) {
      const net = round2(debit - credit);
      if (net > 0.005) {
        const inv: StatementInvoice = {
          customerCode: code,
          number: `DEVIR-${code.replace(/\s+/g, "")}-${currency}-${date}`,
          issueDate: date,
          dueDate: row.averageDueDate ?? row.dueDate ?? date,
          currency,
          amount: net,
          paid: 0,
          opening: true,
          description: "Devir bakiyesi / opening balance",
        };
        invoices.push(inv);
        byNumber.set(`${code}|${inv.number}`, inv);
      } else if (net < -0.005) {
        credits.push({ customerCode: code, reference: "DEVIR", date, currency, amount: -net, description: "Devir alacak bakiyesi / opening credit" });
      } else ignored += 1;
      continue;
    }

    if (debit > 0) {
      if (!docNo) {
        ignored += 1;
        continue;
      }
      const key = `${code}|${docNo}`;
      const existing = byNumber.get(key);
      if (existing && existing.currency === currency) {
        existing.amount = round2(existing.amount + debit);
      } else {
        const inv: StatementInvoice = {
          customerCode: code,
          number: docNo,
          issueDate: date,
          dueDate: row.dueDate ?? row.averageDueDate ?? date,
          currency,
          amount: debit,
          paid: 0,
          opening: false,
          description: text || null,
        };
        invoices.push(inv);
        byNumber.set(key, inv);
      }
    }
    if (credit > 0) credits.push({ customerCode: code, reference: docNo || "?", date, currency, amount: credit, description: text });
    if (debit <= 0 && credit <= 0) ignored += 1;
  }

  // Apply credits: named invoices first, then FIFO by due date. Credits in date order.
  const allocations: StatementAllocation[] = [];
  const unapplied: StatementCredit[] = [];
  const open = (i: StatementInvoice) => round2(i.amount - i.paid);
  credits.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const cr of credits) {
    let left = cr.amount;
    const pool = invoices
      .filter((i) => i.customerCode === cr.customerCode && i.currency === cr.currency)
      .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : a.issueDate < b.issueDate ? -1 : 1));
    const hay = fold(cr.description);
    const named = pool.filter((i) => !i.opening && hay.includes(fold(i.number)));
    const apply = (inv: StatementInvoice, method: StatementAllocation["method"]) => {
      const amt = round2(Math.min(left, open(inv)));
      if (amt <= 0) return;
      inv.paid = round2(inv.paid + amt);
      left = round2(left - amt);
      allocations.push({ customerCode: cr.customerCode, invoiceNumber: inv.number, reference: cr.reference, date: cr.date, currency: cr.currency, amount: amt, method });
    };
    for (const inv of named) if (left > 0) apply(inv, "reference");
    for (const inv of pool) if (left > 0) apply(inv, "fifo");
    if (left > 0.005) unapplied.push({ ...cr, amount: left });
  }
  if (unapplied.length) warnings.push(`${unapplied.length} tahsilat açık borçtan fazla (avans) / ${unapplied.length} credit(s) exceed the open debt (advance payment)`);

  return { customers: [...customers.values()], invoices, allocations, unapplied, period, ignoredRows: ignored, warnings };
}

/** Open balance per currency for one customer (for previews and checks). */
export function openByCurrency(invoices: StatementInvoice[]): Partial<Record<Currency, number>> {
  const out: Partial<Record<Currency, number>> = {};
  for (const i of invoices) out[i.currency] = round2((out[i.currency] ?? 0) + i.amount - i.paid);
  return out;
}
