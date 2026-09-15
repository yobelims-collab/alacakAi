import type { AutomationRule, CollectionStage, Invoice, InvoiceStatus, PaymentPromise } from "@/lib/types";
import { daysBetween } from "./dates";
import { round2 } from "./money";

export const AGING_BUCKETS = ["0-7", "8-30", "31-60", "61-90", "90+"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export function outstanding(inv: Pick<Invoice, "amount" | "paid_amount">): number {
  return round2(Math.max(0, inv.amount - inv.paid_amount));
}

/** Positive when past due, negative when due in the future. */
export function daysOverdue(inv: Pick<Invoice, "due_date">, asOf: string): number {
  return daysBetween(inv.due_date, asOf);
}

export function isOpen(inv: Pick<Invoice, "status" | "amount" | "paid_amount">): boolean {
  return inv.status !== "PAID" && inv.status !== "DRAFT" && outstanding(inv) > 0;
}

export function agingBucket(days: number): AgingBucket {
  if (days <= 7) return "0-7";
  if (days <= 30) return "8-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

/**
 * Derives the date-driven status. Statuses set by humans or by the AI workflow
 * (PAID, DISPUTED, ESCALATED, PAYMENT_PROMISED, PARTIALLY_PAID, DRAFT) are sticky.
 */
export function deriveStatus(inv: Invoice, asOf: string, dueSoonDays = 7): InvoiceStatus {
  const out = outstanding(inv);
  if (inv.status === "DRAFT") return "DRAFT";
  if (out <= 0) return "PAID";
  if (inv.status === "DISPUTED" || inv.status === "ESCALATED") return inv.status;
  if (inv.status === "PAYMENT_PROMISED") return "PAYMENT_PROMISED";
  if (inv.paid_amount > 0) return "PARTIALLY_PAID";
  const d = daysOverdue(inv, asOf);
  if (d > 0) return "OVERDUE";
  if (d === 0) return "DUE_TODAY";
  if (-d <= dueSoonDays) return "DUE_SOON";
  return "SENT";
}

/** Which collection stage the calendar puts an invoice in, according to the automation rules. */
export function stageForInvoice(inv: Invoice, asOf: string, rules: AutomationRule): CollectionStage {
  if (!isOpen(inv) || inv.status === "DISPUTED") return "NONE";
  if (inv.status === "ESCALATED") return "ESCALATED";
  const d = daysOverdue(inv, asOf);
  if (d >= rules.escalation_days) return "ESCALATED";
  if (d >= rules.second_reminder_days) return "OVERDUE_MID";
  if (d >= rules.first_reminder_days && d > 0) return "OVERDUE_EARLY";
  if (d === 0) return "DUE_TODAY";
  if (d < 0 && -d <= rules.pre_due_days) return "PRE_DUE";
  return "NONE";
}

export const STAGE_ORDER: Record<CollectionStage, number> = {
  NONE: 0,
  PRE_DUE: 1,
  DUE_TODAY: 2,
  OVERDUE_EARLY: 3,
  OVERDUE_MID: 4,
  ESCALATED: 5,
};

export function activePromise(promises: PaymentPromise[], invoiceId: string): PaymentPromise | undefined {
  return promises.find((p) => p.invoice_id === invoiceId && p.status === "ACTIVE");
}

export interface InvoiceView extends Invoice {
  outstanding: number;
  days_overdue: number;
  effective_status: InvoiceStatus;
  aging: AgingBucket | null;
}

export function toInvoiceView(inv: Invoice, asOf: string): InvoiceView {
  const d = daysOverdue(inv, asOf);
  const open = isOpen(inv);
  return {
    ...inv,
    outstanding: outstanding(inv),
    days_overdue: open ? Math.max(0, d) : 0,
    effective_status: deriveStatus(inv, asOf),
    aging: open && d > 0 ? agingBucket(d) : null,
  };
}
