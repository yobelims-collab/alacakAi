/**
 * Pure parser for Turkish e-Fatura / e-Arşiv invoices (UBL-TR 1.2 XML).
 * Used on the client (preview) and on the server (import). It only reads values:
 * DOCTYPE/entity declarations are rejected, nothing from the document is ever executed or fetched.
 */
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { isValidDateString } from "./dates";
import { CURRENCIES, type Currency } from "@/lib/types";

export interface EFaturaInvoice {
  /** cbc:ID — the 16-character invoice number (e.g. ABC2026000000123). */
  invoiceNumber: string;
  /** cbc:UUID — ETTN (Evrensel Tekil Tanımlama Numarası). */
  ettn: string | null;
  issueDate: string;
  /** PaymentMeans/PaymentDueDate, else PaymentTerms/PaymentDueDate, else null. */
  dueDate: string | null;
  currency: Currency;
  /** LegalMonetaryTotal/PayableAmount. */
  amount: number;
  buyerName: string;
  buyerTaxId: string | null;
  buyerTaxScheme: "VKN" | "TCKN" | null;
  buyerEmail: string | null;
  buyerPhone: string | null;
  /** cbc:InvoiceTypeCode, e.g. SATIS, TEVKIFAT, ISTISNA. */
  invoiceType: string | null;
  /** cbc:ProfileID, e.g. TEMELFATURA, TICARIFATURA, EARSIVFATURA. */
  profileId: string | null;
  note: string | null;
}

export type EFaturaParseResult = { ok: true; invoice: EFaturaInvoice } | { ok: false; error: string };

type Node = Record<string, unknown>;

const CURRENCY_ALIASES: Record<string, string> = { TL: "TRY", TRL: "TRY", YTL: "TRY" };

function asArray(v: unknown): unknown[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function first(v: unknown): unknown {
  return Array.isArray(v) ? v[0] : v;
}

function child(node: unknown, ...path: string[]): unknown {
  let cur: unknown = node;
  for (const key of path) {
    cur = first(cur);
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Node)[key];
  }
  return cur;
}

/** Text content of an element (handles elements that carry attributes → `#text`). */
function text(v: unknown): string | null {
  const n = first(v);
  if (n === undefined || n === null) return null;
  if (typeof n === "string" || typeof n === "number" || typeof n === "boolean") {
    const s = String(n).trim();
    return s ? s : null;
  }
  if (typeof n === "object" && "#text" in (n as Node)) return text((n as Node)["#text"]);
  return null;
}

function attr(v: unknown, name: string): string | null {
  const n = first(v);
  if (!n || typeof n !== "object") return null;
  const a = (n as Node)[`@_${name}`];
  return typeof a === "string" && a.trim() ? a.trim() : null;
}

function date(v: unknown): string | null {
  const s = text(v);
  if (!s) return null;
  const d = s.slice(0, 10);
  return isValidDateString(d) ? d : null;
}

/** UBL amounts are xsd:decimal ("18500.00"); a comma-decimal form is tolerated. */
function decimal(s: string | null): number | null {
  if (!s) return null;
  let v = s.replace(/\s/g, "");
  if (/^-?\d+(,\d+)?$/.test(v)) v = v.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normaliseCurrency(raw: string | null): string | null {
  if (!raw) return null;
  const up = raw.trim().toUpperCase();
  return CURRENCY_ALIASES[up] ?? up;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: false,
  htmlEntities: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
});

export function parseEFatura(xml: string): EFaturaParseResult {
  if (typeof xml !== "string" || !xml.trim()) return { ok: false, error: "Boş dosya / empty file" };
  const src = xml.replace(/^﻿/, "");
  // No DTDs: blocks entity-expansion (billion laughs) and external entity tricks outright.
  if (/<!DOCTYPE|<!ENTITY/i.test(src)) return { ok: false, error: "DOCTYPE/ENTITY bildirimleri desteklenmiyor / DOCTYPE is not allowed" };
  const valid = XMLValidator.validate(src);
  if (valid !== true) return { ok: false, error: `Geçersiz XML / invalid XML: ${valid.err.msg} (line ${valid.err.line})` };

  let doc: Node;
  try {
    doc = parser.parse(src) as Node;
  } catch (e) {
    return { ok: false, error: `Geçersiz XML / invalid XML: ${e instanceof Error ? e.message : "parse error"}` };
  }
  const inv = first(doc.Invoice);
  if (!inv || typeof inv !== "object") {
    if (doc.CreditNote) return { ok: false, error: "İade/alacak dekontu desteklenmiyor / credit notes are not supported" };
    return { ok: false, error: "UBL-TR Invoice kök elemanı bulunamadı / not a UBL-TR invoice (no <Invoice> root)" };
  }

  const invoiceNumber = text(child(inv, "ID"));
  if (!invoiceNumber) return { ok: false, error: "Fatura numarası (cbc:ID) yok / missing invoice number" };

  const invoiceType = text(child(inv, "InvoiceTypeCode"))?.toUpperCase() ?? null;
  if (invoiceType && invoiceType.includes("IADE")) return { ok: false, error: `İade faturası (${invoiceType}) alacak olarak içe aktarılamaz / return invoices (${invoiceType}) cannot be imported as receivables` };

  const issueDate = date(child(inv, "IssueDate"));
  if (!issueDate) return { ok: false, error: "Düzenleme tarihi (cbc:IssueDate) yok veya geçersiz / missing or invalid issue date" };

  const currencyRaw = normaliseCurrency(text(child(inv, "DocumentCurrencyCode")) ?? attr(child(inv, "LegalMonetaryTotal", "PayableAmount"), "currencyID"));
  if (!currencyRaw) return { ok: false, error: "Para birimi (cbc:DocumentCurrencyCode) yok / missing currency" };
  if (!(CURRENCIES as string[]).includes(currencyRaw)) return { ok: false, error: `Desteklenmeyen para birimi: ${currencyRaw} (TRY, EUR, USD, GBP) / unsupported currency` };
  const currency = currencyRaw as Currency;

  const amount = decimal(text(child(inv, "LegalMonetaryTotal", "PayableAmount")));
  if (amount === null) return { ok: false, error: "Ödenecek tutar (cbc:PayableAmount) yok veya geçersiz / missing or invalid payable amount" };
  if (amount <= 0) return { ok: false, error: "Ödenecek tutar sıfırdan büyük olmalı / payable amount must be positive" };

  let dueDate: string | null = null;
  for (const pm of asArray((inv as Node).PaymentMeans)) {
    dueDate = date(child(pm, "PaymentDueDate"));
    if (dueDate) break;
  }
  if (!dueDate) {
    for (const pt of asArray((inv as Node).PaymentTerms)) {
      dueDate = date(child(pt, "PaymentDueDate"));
      if (dueDate) break;
    }
  }
  if (dueDate && dueDate < issueDate) dueDate = null;

  const party = child(inv, "AccountingCustomerParty", "Party");
  if (!party) return { ok: false, error: "Alıcı (cac:AccountingCustomerParty) yok / missing buyer" };
  let buyerName = text(child(party, "PartyName", "Name"));
  if (!buyerName) {
    const person = child(party, "Person");
    buyerName = [text(child(person, "FirstName")), text(child(person, "MiddleName")), text(child(person, "FamilyName"))].filter(Boolean).join(" ") || null;
  }
  if (!buyerName) return { ok: false, error: "Alıcı adı yok / missing buyer name" };

  let buyerTaxId: string | null = null;
  let buyerTaxScheme: EFaturaInvoice["buyerTaxScheme"] = null;
  for (const pid of asArray((first(party) as Node).PartyIdentification)) {
    const idNode = child(pid, "ID");
    const scheme = attr(idNode, "schemeID")?.toUpperCase();
    if (scheme === "VKN" || scheme === "TCKN") {
      buyerTaxId = text(idNode);
      buyerTaxScheme = scheme;
      if (buyerTaxId) break;
    }
  }

  const email = text(child(party, "Contact", "ElectronicMail"));
  const phone = text(child(party, "Contact", "Telephone"));

  return {
    ok: true,
    invoice: {
      invoiceNumber: invoiceNumber.slice(0, 64),
      ettn: text(child(inv, "UUID"))?.toLowerCase() ?? null,
      issueDate,
      dueDate,
      currency,
      amount,
      buyerName: buyerName.replace(/\s+/g, " ").slice(0, 200),
      buyerTaxId,
      buyerTaxScheme,
      buyerEmail: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
      buyerPhone: phone,
      invoiceType,
      profileId: text(child(inv, "ProfileID")),
      note: text((inv as Node).Note),
    },
  };
}
