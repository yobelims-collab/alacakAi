import type { Customer, Invoice, Locale } from "@/lib/types";
import { isOpen, outstanding } from "@/lib/domain/invoices";

export interface MatchCandidate {
  invoice: Invoice;
  confidence: number; // 0..1
  reasons: string[];
}

export interface MatchInput {
  amount: number;
  currency: Invoice["currency"];
  reference: string | null;
  description?: string | null;
  customer_id?: string | null;
  payment_date?: string;
}

function norm(s: string | null | undefined): string {
  return (s ?? "").toLocaleLowerCase("tr").replace(/[^a-z0-9çğıöşü]/g, "");
}

/** Digits of an invoice number, e.g. INV-2026-00182 -> "202600182", and its last block "182". */
function numberTokens(invoiceNumber: string): { full: string; digits: string; lastBlock: string } {
  const digits = invoiceNumber.replace(/\D/g, "");
  const blocks = invoiceNumber.split(/[^0-9]+/).filter(Boolean);
  const lastBlock = blocks[blocks.length - 1] ?? "";
  return { full: norm(invoiceNumber), digits, lastBlock: lastBlock.replace(/^0+/, "") };
}

/**
 * Deterministic matching of an incoming payment to open invoices. Scores:
 *  - invoice number (or its numeric tail) present in reference/description: +0.55
 *  - exact outstanding amount: +0.3 (near: +0.15, partial share: +0.05)
 *  - currency match: +0.05 (mismatch: hard penalty)
 *  - customer name present in reference/description or customer id equal: +0.1
 * Only candidates with confidence >= 0.35 are returned, best first.
 */
export function suggestMatches(payment: MatchInput, invoices: Invoice[], customers: Customer[], locale: Locale = "tr"): MatchCandidate[] {
  const tr = locale === "tr";
  const text = norm(`${payment.reference ?? ""} ${payment.description ?? ""}`);
  const textDigits = `${payment.reference ?? ""} ${payment.description ?? ""}`.replace(/\D+/g, " ");
  const customerById = new Map(customers.map((c) => [c.id, c]));
  const out: MatchCandidate[] = [];

  for (const inv of invoices) {
    if (!isOpen(inv)) continue;
    let score = 0;
    let numberMatched = false;
    const reasons: string[] = [];
    const tokens = numberTokens(inv.invoice_number);

    if (text && tokens.full && text.includes(tokens.full)) {
      score += 0.55;
      numberMatched = true;
      reasons.push(tr ? "Fatura numarası referansta geçiyor" : "Invoice number appears in the reference");
    } else if (tokens.lastBlock.length >= 3 && new RegExp(`(^|\\D)0*${tokens.lastBlock}(\\D|$)`).test(textDigits)) {
      score += 0.45;
      numberMatched = true;
      reasons.push(tr ? `Referans fatura numarasının son bloğunu içeriyor (${tokens.lastBlock})` : `Reference contains the invoice number tail (${tokens.lastBlock})`);
    }

    const due = outstanding(inv);
    if (payment.currency !== inv.currency) {
      score -= 0.5;
      reasons.push(tr ? "Para birimi uyuşmuyor" : "Currency mismatch");
    } else {
      score += 0.05;
      const diff = Math.abs(due - payment.amount);
      if (diff < 0.01) {
        score += numberMatched ? 0.4 : 0.3; // two independent signals agreeing
        reasons.push(tr ? "Tutar kalan bakiyeyle birebir eşleşiyor" : "Amount equals the outstanding balance exactly");
      } else if (diff / Math.max(due, 1) <= 0.02) {
        score += 0.15;
        reasons.push(tr ? "Tutar kalan bakiyeye çok yakın (banka masrafı olabilir)" : "Amount is within 2% of the outstanding balance (bank charges?)");
      } else if (payment.amount < due) {
        score += 0.05;
        reasons.push(tr ? "Kısmi ödeme olabilir" : "Possible partial payment");
      } else {
        score -= 0.1;
      }
    }

    const customer = customerById.get(inv.customer_id);
    if (payment.customer_id && payment.customer_id === inv.customer_id) {
      score += 0.1;
      reasons.push(tr ? "Aynı müşteri" : "Same customer");
    } else if (customer) {
      const words = customer.company_name.split(/\s+/).map(norm).filter((w) => w.length >= 4);
      if (words.some((w) => text.includes(w))) {
        score += 0.1;
        reasons.push(tr ? "Müşteri adı referansta geçiyor" : "Customer name appears in the reference");
      }
    }

    const confidence = Math.max(0, Math.min(0.99, Math.round(score * 100) / 100));
    if (confidence >= 0.35) out.push({ invoice: inv, confidence, reasons });
  }

  return out.sort((a, b) => b.confidence - a.confidence || a.invoice.due_date.localeCompare(b.invoice.due_date));
}
