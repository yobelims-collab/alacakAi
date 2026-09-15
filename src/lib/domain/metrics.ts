import type { Customer, Invoice, Organization, Payment, PaymentPromise } from "@/lib/types";
import { addDays, daysBetween } from "./dates";
import { AGING_BUCKETS, agingBucket, daysOverdue, isOpen, outstanding, type AgingBucket } from "./invoices";
import { round2, toReporting } from "./money";

type OrgFx = Pick<Organization, "reporting_currency" | "fx_rates">;

export interface DashboardMetrics {
  totalReceivables: number;
  overdue: number;
  dueThisWeek: number;
  collectedThisMonth: number;
  collectionRate: number; // 0..100
  overdueCount: number;
  openCount: number;
  aging: { bucket: AgingBucket; amount: number; count: number }[];
  receivablesSeries: { date: string; outstanding: number; overdue: number }[];
  collectedVsOutstanding: { month: string; collected: number; outstanding: number }[];
}

export function computeDashboardMetrics(
  invoices: Invoice[],
  payments: Payment[],
  org: OrgFx,
  asOf: string,
): DashboardMetrics {
  const open = invoices.filter(isOpen);
  const rep = (amt: number, c: Invoice["currency"]) => toReporting(amt, c, org);

  const totalReceivables = open.reduce((s, i) => s + rep(outstanding(i), i.currency), 0);
  const overdueInv = open.filter((i) => daysOverdue(i, asOf) > 0);
  const overdue = overdueInv.reduce((s, i) => s + rep(outstanding(i), i.currency), 0);
  const weekEnd = addDays(asOf, 7);
  const dueThisWeek = open
    .filter((i) => i.due_date >= asOf && i.due_date <= weekEnd)
    .reduce((s, i) => s + rep(outstanding(i), i.currency), 0);

  const monthStart = asOf.slice(0, 7) + "-01";
  const collectedThisMonth = payments
    .filter((p) => p.status !== "REFUND" && p.payment_date >= monthStart && p.payment_date <= asOf)
    .reduce((s, p) => s + rep(p.amount, p.currency), 0);

  // Collection rate: share of invoiced money (due in the last 90 days) that has been paid.
  const window = invoices.filter(
    (i) => i.status !== "DRAFT" && i.due_date >= addDays(asOf, -90) && i.due_date <= asOf,
  );
  const invoiced = window.reduce((s, i) => s + rep(i.amount, i.currency), 0);
  const paid = window.reduce((s, i) => s + rep(Math.min(i.paid_amount, i.amount), i.currency), 0);
  const collectionRate = invoiced > 0 ? round2((paid / invoiced) * 100) : 100;

  const aging = AGING_BUCKETS.map((bucket) => ({ bucket, amount: 0, count: 0 }));
  for (const i of overdueInv) {
    const b = aging.find((a) => a.bucket === agingBucket(daysOverdue(i, asOf)))!;
    b.amount += rep(outstanding(i), i.currency);
    b.count += 1;
  }

  // 12 weekly points of outstanding & overdue, reconstructed from invoice and payment dates.
  const receivablesSeries: DashboardMetrics["receivablesSeries"] = [];
  for (let w = 11; w >= 0; w--) {
    const date = addDays(asOf, -7 * w);
    let outs = 0;
    let ovd = 0;
    for (const i of invoices) {
      if (i.status === "DRAFT" || i.invoice_date > date) continue;
      const paidBy = payments
        .filter((p) => p.matched_invoice_id === i.id && p.payment_date <= date && p.status !== "REFUND")
        .reduce((s, p) => s + p.amount, 0);
      const remaining = Math.max(0, i.amount - paidBy);
      if (remaining <= 0) continue;
      const v = rep(remaining, i.currency);
      outs += v;
      if (daysBetween(i.due_date, date) > 0) ovd += v;
    }
    receivablesSeries.push({ date, outstanding: round2(outs), overdue: round2(ovd) });
  }

  const collectedVsOutstanding: DashboardMetrics["collectedVsOutstanding"] = [];
  for (let m = 5; m >= 0; m--) {
    const d = new Date(`${asOf}T00:00:00Z`);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - m);
    const month = d.toISOString().slice(0, 7);
    const collected = payments
      .filter((p) => p.status !== "REFUND" && p.payment_date.startsWith(month))
      .reduce((s, p) => s + rep(p.amount, p.currency), 0);
    const outstandingM = invoices
      .filter((i) => i.status !== "DRAFT" && i.invoice_date.startsWith(month))
      .reduce((s, i) => s + rep(outstanding(i), i.currency), 0);
    collectedVsOutstanding.push({ month, collected: round2(collected), outstanding: round2(outstandingM) });
  }

  return {
    totalReceivables: round2(totalReceivables),
    overdue: round2(overdue),
    dueThisWeek: round2(dueThisWeek),
    collectedThisMonth: round2(collectedThisMonth),
    collectionRate,
    overdueCount: overdueInv.length,
    openCount: open.length,
    aging: aging.map((a) => ({ ...a, amount: round2(a.amount) })),
    receivablesSeries,
    collectedVsOutstanding,
  };
}

export interface CustomerFinancials {
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
  overdue: number;
  overdueCount: number;
  openCount: number;
  averageDelayDays: number;
  brokenPromises90d: number;
  activePromises: number;
  lastPaymentDate: string | null;
  nextExpectedPayment: string | null;
  disputedCount: number;
  currency: Customer["currency"];
}

/** Reported in the customer's own currency (all of a customer's invoices share it). */
export function computeCustomerFinancials(
  customer: Customer,
  invoices: Invoice[],
  payments: Payment[],
  promises: PaymentPromise[],
  asOf: string,
): CustomerFinancials {
  const inv = invoices.filter((i) => i.customer_id === customer.id && i.status !== "DRAFT");
  const pays = payments.filter((p) => p.customer_id === customer.id && p.status !== "REFUND");
  const proms = promises.filter((p) => p.customer_id === customer.id);

  const totalInvoiced = inv.reduce((s, i) => s + i.amount, 0);
  const totalPaid = inv.reduce((s, i) => s + Math.min(i.paid_amount, i.amount), 0);
  const open = inv.filter(isOpen);
  const outs = open.reduce((s, i) => s + outstanding(i), 0);
  const overdueInv = open.filter((i) => daysOverdue(i, asOf) > 0);
  const overdue = overdueInv.reduce((s, i) => s + outstanding(i), 0);

  // Average delay: for paid invoices, days between due date and the last matched payment;
  // for open overdue invoices, days overdue so far.
  const delays: number[] = [];
  for (const i of inv) {
    const matched = pays
      .filter((p) => p.matched_invoice_id === i.id)
      .sort((a, b) => (a.payment_date < b.payment_date ? 1 : -1));
    if (i.status === "PAID" && matched[0]) delays.push(daysBetween(i.due_date, matched[0].payment_date));
    else if (isOpen(i) && daysOverdue(i, asOf) > 0) delays.push(daysOverdue(i, asOf));
  }
  const averageDelayDays = delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : 0;

  const since = addDays(asOf, -90);
  const brokenPromises90d = proms.filter(
    (p) => p.status === "BROKEN" && (p.resolved_at ?? p.created_at).slice(0, 10) >= since,
  ).length;
  const active = proms
    .filter((p) => p.status === "ACTIVE")
    .sort((a, b) => (a.promised_date < b.promised_date ? -1 : 1));
  const lastPayment = [...pays].sort((a, b) => (a.payment_date < b.payment_date ? 1 : -1))[0];
  const nextDue = open.filter((i) => i.due_date >= asOf).sort((a, b) => (a.due_date < b.due_date ? -1 : 1))[0];

  return {
    totalInvoiced: round2(totalInvoiced),
    totalPaid: round2(totalPaid),
    outstanding: round2(outs),
    overdue: round2(overdue),
    overdueCount: overdueInv.length,
    openCount: open.length,
    averageDelayDays,
    brokenPromises90d,
    activePromises: active.length,
    lastPaymentDate: lastPayment?.payment_date ?? null,
    nextExpectedPayment: active[0]?.promised_date ?? nextDue?.due_date ?? null,
    disputedCount: inv.filter((i) => i.status === "DISPUTED").length,
    currency: customer.currency,
  };
}
