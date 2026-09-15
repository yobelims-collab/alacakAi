import type { DataStore } from "@/lib/db/store";
import { computeRiskScore } from "@/lib/ai/risk-analyzer";
import { computeCustomerFinancials } from "@/lib/domain/metrics";
import type { Customer, Invoice, Locale, Payment, PaymentPromise, RiskScore } from "@/lib/types";

/** Recomputes and stores the risk score for one customer; returns the new row. */
export async function recomputeRisk(
  store: DataStore,
  customer: Customer,
  data: { invoices: Invoice[]; payments: Payment[]; promises: PaymentPromise[] },
  asOf: string,
  locale: Locale,
): Promise<RiskScore> {
  const fin = computeCustomerFinancials(customer, data.invoices, data.payments, data.promises, asOf);
  const r = computeRiskScore(fin, { creditLimit: customer.credit_limit, locale });
  const existing = (await store.list("risk_scores", { where: { customer_id: customer.id }, limit: 1 }))[0];
  const payload = { score: r.score, level: r.level, reasons: r.reasons, recommendation: r.recommendation, factors: r.factors, computed_at: new Date().toISOString() };
  if (existing) return store.update("risk_scores", existing.id, payload);
  return store.insert("risk_scores", { customer_id: customer.id, ...payload });
}

export async function recomputeAllRisks(store: DataStore, asOf: string, locale: Locale): Promise<RiskScore[]> {
  const [customers, invoices, payments, promises] = await Promise.all([
    store.list("customers"),
    store.list("invoices"),
    store.list("payments"),
    store.list("payment_promises"),
  ]);
  const out: RiskScore[] = [];
  for (const c of customers) out.push(await recomputeRisk(store, c, { invoices, payments, promises }, asOf, locale));
  return out;
}
