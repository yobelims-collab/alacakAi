import "server-only";
import type { AppContext } from "@/lib/db";
import { today } from "@/lib/domain/dates";
import { toInvoiceView, type InvoiceView } from "@/lib/domain/invoices";
import { computeCustomerFinancials, computeDashboardMetrics, type CustomerFinancials, type DashboardMetrics } from "@/lib/domain/metrics";
import type { AiAction, Communication, Customer, Invoice, Payment, PaymentPromise, RiskScore } from "@/lib/types";

/** Read-model helpers shared by pages. Keep pages thin: load here, render there. */

export interface CustomerRow {
  customer: Customer;
  financials: CustomerFinancials;
  risk: RiskScore | null;
  reliability: number; // 0..100, derived from risk score
}

export async function loadCustomers(ctx: AppContext): Promise<CustomerRow[]> {
  const asOf = today();
  const [customers, invoices, payments, promises, risks] = await Promise.all([
    ctx.store.list("customers", { orderBy: "company_name", ascending: true }),
    ctx.store.list("invoices"),
    ctx.store.list("payments"),
    ctx.store.list("payment_promises"),
    ctx.store.list("risk_scores"),
  ]);
  const riskBy = new Map(risks.map((r) => [r.customer_id, r]));
  return customers.map((customer) => {
    const risk = riskBy.get(customer.id) ?? null;
    return { customer, financials: computeCustomerFinancials(customer, invoices, payments, promises, asOf), risk, reliability: risk ? 100 - risk.score : 100 };
  });
}

export interface CustomerDetail extends CustomerRow {
  invoices: InvoiceView[];
  payments: Payment[];
  promises: PaymentPromise[];
  communications: Communication[];
  actions: AiAction[];
  insights: string[];
}

export async function loadCustomerDetail(ctx: AppContext, id: string): Promise<CustomerDetail | null> {
  const asOf = today();
  const customer = await ctx.store.get("customers", id);
  if (!customer) return null;
  const [invoices, payments, promises, communications, actions, risks] = await Promise.all([
    ctx.store.list("invoices", { where: { customer_id: id }, orderBy: "due_date" }),
    ctx.store.list("payments", { where: { customer_id: id }, orderBy: "payment_date" }),
    ctx.store.list("payment_promises", { where: { customer_id: id } }),
    ctx.store.list("communications", { where: { customer_id: id } }),
    ctx.store.list("ai_actions", { where: { customer_id: id } }),
    ctx.store.list("risk_scores", { where: { customer_id: id }, limit: 1 }),
  ]);
  const financials = computeCustomerFinancials(customer, invoices, payments, promises, asOf);
  const risk = risks[0] ?? null;
  return {
    customer,
    financials,
    risk,
    reliability: risk ? 100 - risk.score : 100,
    invoices: invoices.map((i) => toInvoiceView(i, asOf)),
    payments,
    promises,
    communications,
    actions,
    insights: buildInsights(customer, financials, risk, invoices.map((i) => toInvoiceView(i, asOf)), ctx.locale),
  };
}

function buildInsights(customer: Customer, f: CustomerFinancials, risk: RiskScore | null, invoices: InvoiceView[], locale: "tr" | "en"): string[] {
  const tr = locale === "tr";
  const out: string[] = [];
  if (f.averageDelayDays > 0) out.push(tr ? `Müşteri genellikle vadeden ${Math.max(1, f.averageDelayDays - 2)}–${f.averageDelayDays + 2} gün sonra ödüyor.` : `Customer usually pays ${Math.max(1, f.averageDelayDays - 2)}–${f.averageDelayDays + 2} days after the due date.`);
  else if (f.totalPaid > 0) out.push(tr ? "Müşteri faturaları vadesinde ödüyor." : "Customer pays invoices on time.");
  const worst = invoices.filter((i) => i.days_overdue > 0).sort((a, b) => b.days_overdue - a.days_overdue)[0];
  if (worst) out.push(tr ? `${worst.invoice_number} numaralı fatura ${worst.days_overdue} gündür gecikmiş.` : `Invoice ${worst.invoice_number} is ${worst.days_overdue} days overdue.`);
  if (f.brokenPromises90d > 0) out.push(tr ? `Son 90 günde ${f.brokenPromises90d} ödeme sözü tutulmadı.` : `Customer has broken ${f.brokenPromises90d} payment promise${f.brokenPromises90d > 1 ? "s" : ""} in the last 90 days.`);
  if (f.activePromises > 0 && f.nextExpectedPayment) out.push(tr ? `Aktif ödeme sözü: ${f.nextExpectedPayment}.` : `Active payment promise for ${f.nextExpectedPayment}.`);
  if (customer.credit_limit && f.outstanding / customer.credit_limit > 0.8) out.push(tr ? `Kredi limitinin %${Math.round((f.outstanding / customer.credit_limit) * 100)}'i kullanılıyor.` : `${Math.round((f.outstanding / customer.credit_limit) * 100)}% of the credit limit is in use.`);
  if (risk) out.push((tr ? "Önerilen aksiyon: " : "Recommended action: ") + risk.recommendation);
  return out;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  overdue: (InvoiceView & { customer: Customer; risk: RiskScore | null })[];
  attention: (AiAction & { customer: Customer | null; invoice: Invoice | null })[];
  pendingApprovals: (Communication & { customer: Customer | null; invoice: Invoice | null })[];
  recentActions: AiAction[];
}

export async function loadDashboard(ctx: AppContext): Promise<DashboardData> {
  const asOf = today();
  const [invoices, payments, customers, risks, actions, comms] = await Promise.all([
    ctx.store.list("invoices"),
    ctx.store.list("payments"),
    ctx.store.list("customers"),
    ctx.store.list("risk_scores"),
    ctx.store.list("ai_actions", { limit: 200 }),
    ctx.store.list("communications", { where: { status: "PENDING_APPROVAL" } }),
  ]);
  const custBy = new Map(customers.map((c) => [c.id, c]));
  const invBy = new Map(invoices.map((i) => [i.id, i]));
  const riskBy = new Map(risks.map((r) => [r.customer_id, r]));
  const views = invoices.map((i) => toInvoiceView(i, asOf));
  const overdue = views
    .filter((v) => v.days_overdue > 0 && v.outstanding > 0)
    .sort((a, b) => b.days_overdue - a.days_overdue)
    .map((v) => ({ ...v, customer: custBy.get(v.customer_id)!, risk: riskBy.get(v.customer_id) ?? null }));
  return {
    metrics: computeDashboardMetrics(invoices, payments, ctx.org, asOf),
    overdue,
    attention: actions.filter((a) => a.status === "NEEDS_HUMAN").map((a) => ({ ...a, customer: a.customer_id ? (custBy.get(a.customer_id) ?? null) : null, invoice: a.invoice_id ? (invBy.get(a.invoice_id) ?? null) : null })),
    pendingApprovals: comms.map((c) => ({ ...c, customer: custBy.get(c.customer_id) ?? null, invoice: c.invoice_id ? (invBy.get(c.invoice_id) ?? null) : null })),
    recentActions: actions.slice(0, 8),
  };
}
