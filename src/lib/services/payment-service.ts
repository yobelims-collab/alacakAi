import "server-only";
import type { AppContext } from "@/lib/db";
import { suggestMatches, type MatchCandidate } from "@/lib/ai/payment-matcher";
import { today } from "@/lib/domain/dates";
import { outstanding } from "@/lib/domain/invoices";
import { formatMoney, round2 } from "@/lib/domain/money";
import type { BankTransaction, Currency, Invoice, Payment } from "@/lib/types";
import type { BankCsvRow, PaymentInput } from "@/lib/validation";
import { audit } from "./audit";
import { refreshCustomerRisk } from "./collection-service";

/** Records a payment; if `matched_invoice_id` is given it is applied immediately, otherwise AI suggests. */
export async function recordPayment(ctx: AppContext, input: PaymentInput, source: Payment["source"] = "MANUAL", bankTransactionId: string | null = null): Promise<Payment> {
  const { store } = ctx;
  let payment = await store.insert("payments", {
    customer_id: input.customer_id,
    payment_date: input.payment_date,
    amount: input.amount,
    currency: input.currency,
    reference: input.reference,
    matched_invoice_id: null,
    status: "UNMATCHED",
    source,
    bank_transaction_id: bankTransactionId,
    suggested_invoice_id: null,
    suggested_confidence: null,
    suggestion_reasons: null,
  });
  await audit(store, { user_id: ctx.user.id, action: "payment.recorded", entity_type: "payment", entity_id: payment.id, details: { amount: input.amount, currency: input.currency } });

  if (input.matched_invoice_id) {
    payment = await matchPayment(ctx, payment.id, input.matched_invoice_id);
  } else {
    payment = await suggestForPayment(ctx, payment);
  }
  return payment;
}

/** Runs the matcher and stores the best suggestion on the payment (no state change on invoices). */
export async function suggestForPayment(ctx: AppContext, payment: Payment): Promise<Payment> {
  const [invoices, customers] = await Promise.all([ctx.store.list("invoices"), ctx.store.list("customers")]);
  const candidates = suggestMatches({ amount: payment.amount, currency: payment.currency, reference: payment.reference, customer_id: payment.customer_id, payment_date: payment.payment_date }, invoices, customers, ctx.locale);
  const best = candidates[0];
  const updated = await ctx.store.update("payments", payment.id, {
    suggested_invoice_id: best?.invoice.id ?? null,
    suggested_confidence: best?.confidence ?? null,
    suggestion_reasons: best?.reasons ?? null,
  });
  if (best) {
    const customer = customers.find((c) => c.id === best.invoice.customer_id);
    await ctx.store.insert("ai_actions", {
      customer_id: best.invoice.customer_id,
      invoice_id: best.invoice.id,
      communication_id: null,
      type: "PAYMENT_MATCH_SUGGESTED",
      status: "PENDING_APPROVAL",
      severity: "INFO",
      title: `${ctx.t.actionType.PAYMENT_MATCH_SUGGESTED}: ${formatMoney(payment.amount, payment.currency, ctx.locale)} → ${best.invoice.invoice_number}`,
      description: `${customer?.company_name ?? ""} · ${Math.round(best.confidence * 100)}%`,
      recommended_action: null,
      payload: { payment_id: payment.id, confidence: best.confidence, reasons: best.reasons },
      resolved_at: null,
      resolved_by: null,
    });
  }
  return updated;
}

export async function candidatesForPayment(ctx: AppContext, payment: Payment): Promise<MatchCandidate[]> {
  const [invoices, customers] = await Promise.all([ctx.store.list("invoices"), ctx.store.list("customers")]);
  return suggestMatches({ amount: payment.amount, currency: payment.currency, reference: payment.reference, customer_id: payment.customer_id }, invoices, customers, ctx.locale);
}

/** Applies a payment to an invoice (human-confirmed). Updates invoice, promises, bank transaction. */
export async function matchPayment(ctx: AppContext, paymentId: string, invoiceId: string): Promise<Payment> {
  const { store } = ctx;
  const payment = await store.get("payments", paymentId);
  const invoice = await store.get("invoices", invoiceId);
  if (!payment || !invoice) throw new Error("payment or invoice not found");
  if (payment.status === "MATCHED") throw new Error("payment already matched");
  if (payment.currency !== invoice.currency) throw new Error("currency mismatch");

  const before = outstanding(invoice);
  const applied = Math.min(payment.amount, before);
  const newPaid = round2(invoice.paid_amount + applied);
  const fullyPaid = newPaid >= invoice.amount - 0.005;
  const now = new Date().toISOString();

  const updatedInvoice: Partial<Invoice> = { paid_amount: fullyPaid ? invoice.amount : newPaid, status: fullyPaid ? "PAID" : "PARTIALLY_PAID", updated_at: now };
  if (fullyPaid) updatedInvoice.collection_stage = "NONE";
  await store.update("invoices", invoice.id, updatedInvoice);

  const updatedPayment = await store.update("payments", payment.id, {
    matched_invoice_id: invoice.id,
    customer_id: invoice.customer_id,
    status: applied < payment.amount || !fullyPaid ? "PARTIAL" : "MATCHED",
    suggested_invoice_id: null,
    suggested_confidence: null,
    suggestion_reasons: null,
  });
  if (payment.bank_transaction_id) {
    await store.update("bank_transactions", payment.bank_transaction_id, { status: "MATCHED", matched_invoice_id: invoice.id, payment_id: payment.id });
  }

  // Promises on this invoice are kept when the invoice is settled (or the promised amount covered).
  for (const p of await store.list("payment_promises", { where: { invoice_id: invoice.id, status: "ACTIVE" } })) {
    if (fullyPaid || (p.amount !== null && applied >= p.amount - 0.005)) {
      await store.update("payment_promises", p.id, { status: "KEPT", resolved_at: now });
      await store.insert("ai_actions", { customer_id: invoice.customer_id, invoice_id: invoice.id, communication_id: null, type: "PROMISE_KEPT", status: "COMPLETED", severity: "SUCCESS", title: `${ctx.t.actionType.PROMISE_KEPT}: ${invoice.invoice_number}`, description: null, recommended_action: null, payload: { promise_id: p.id }, resolved_at: null, resolved_by: null });
    }
  }
  // Close pending suggestion actions for this payment.
  for (const a of await store.list("ai_actions", { where: { type: "PAYMENT_MATCH_SUGGESTED", status: "PENDING_APPROVAL" } })) {
    if ((a.payload as { payment_id?: string } | null)?.payment_id === payment.id) await store.update("ai_actions", a.id, { status: "COMPLETED", resolved_at: now, resolved_by: ctx.user.id });
  }
  // Escalations on a now-paid invoice are resolved automatically.
  if (fullyPaid) {
    for (const a of await store.list("ai_actions", { where: { invoice_id: invoice.id, status: "NEEDS_HUMAN" } })) {
      await store.update("ai_actions", a.id, { status: "RESOLVED", resolved_at: now, resolved_by: null });
    }
  }
  const customer = await store.get("customers", invoice.customer_id);
  await store.insert("ai_actions", {
    customer_id: invoice.customer_id,
    invoice_id: invoice.id,
    communication_id: null,
    type: "PAYMENT_MATCHED",
    status: "COMPLETED",
    severity: "SUCCESS",
    title: `${ctx.t.actionType.PAYMENT_MATCHED}: ${formatMoney(applied, invoice.currency, ctx.locale)} → ${invoice.invoice_number}${fullyPaid ? ` (${ctx.t.status.PAID})` : ""}`,
    description: customer?.company_name ?? null,
    recommended_action: null,
    payload: { payment_id: payment.id, applied, fully_paid: fullyPaid },
    resolved_at: null,
    resolved_by: null,
  });
  await audit(store, { user_id: ctx.user.id, action: "payment.matched", entity_type: "payment", entity_id: payment.id, details: { invoice_id: invoice.id, applied, fully_paid: fullyPaid } });
  if (customer) await refreshCustomerRisk(ctx, customer);
  return updatedPayment;
}

export async function rejectSuggestion(ctx: AppContext, paymentId: string): Promise<void> {
  const payment = await ctx.store.get("payments", paymentId);
  if (!payment) throw new Error("payment not found");
  await ctx.store.update("payments", paymentId, { suggested_invoice_id: null, suggested_confidence: null, suggestion_reasons: null });
  for (const a of await ctx.store.list("ai_actions", { where: { type: "PAYMENT_MATCH_SUGGESTED", status: "PENDING_APPROVAL" } })) {
    if ((a.payload as { payment_id?: string } | null)?.payment_id === paymentId) await ctx.store.update("ai_actions", a.id, { status: "REJECTED", resolved_at: new Date().toISOString(), resolved_by: ctx.user.id });
  }
  await audit(ctx.store, { user_id: ctx.user.id, action: "payment.suggestion_rejected", entity_type: "payment", entity_id: paymentId });
}

/** Imports validated bank rows: each credit becomes an UNMATCHED payment with an AI suggestion. */
export async function importBankTransactions(ctx: AppContext, rows: BankCsvRow[]): Promise<{ imported: number; suggested: number; skipped: number }> {
  const existing = await ctx.store.list("bank_transactions");
  const seen = new Set(existing.map((t) => `${t.transaction_date}|${t.amount}|${t.reference ?? ""}|${t.description ?? ""}`));
  let imported = 0;
  let suggested = 0;
  let skipped = 0;
  for (const row of rows) {
    const key = `${row.transaction_date}|${row.amount}|${row.reference ?? ""}|${row.description ?? ""}`;
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    const tx: BankTransaction = await ctx.store.insert("bank_transactions", {
      transaction_date: row.transaction_date,
      description: row.description,
      reference: row.reference,
      amount: row.amount,
      currency: row.currency as Currency,
      status: row.amount > 0 ? "UNMATCHED" : "IGNORED",
      matched_invoice_id: null,
      payment_id: null,
    });
    imported += 1;
    if (row.amount <= 0) continue; // debits are not receivable payments
    const payment = await recordPayment(ctx, { customer_id: null, payment_date: row.transaction_date, amount: row.amount, currency: row.currency as Currency, reference: [row.reference, row.description].filter(Boolean).join(" · ") || null, matched_invoice_id: null }, "BANK_IMPORT", tx.id);
    await ctx.store.update("bank_transactions", tx.id, { payment_id: payment.id });
    if (payment.suggested_invoice_id) suggested += 1;
  }
  await audit(ctx.store, { user_id: ctx.user.id, action: "bank.import", entity_type: "bank_transaction", details: { imported, suggested, skipped } });
  return { imported, suggested, skipped };
}

export { today };
