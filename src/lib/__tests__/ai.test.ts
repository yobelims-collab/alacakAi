import { describe, expect, it } from "vitest";
import { classifyReply, classifyWithRules, extractDate } from "@/lib/ai/response-classifier";
import { evaluateEscalation } from "@/lib/ai/escalation-rules";
import { generateMessage, validateOutboundMessage } from "@/lib/ai/message-generator";
import { renderTemplate } from "@/lib/ai/templates";
import { computeRiskScore } from "@/lib/ai/risk-analyzer";
import { suggestMatches } from "@/lib/ai/payment-matcher";
import type { Customer, Invoice } from "@/lib/types";
import type { CustomerFinancials } from "@/lib/domain/metrics";

const asOf = "2026-09-15"; // Tuesday

describe("date extraction", () => {
  it("resolves relative and absolute dates", () => {
    expect(extractDate("We will pay next Friday.", asOf)).toBe("2026-09-25");
    expect(extractDate("Ödemeyi cuma günü yapacağız", asOf)).toBe("2026-09-18");
    expect(extractDate("Payment on 25 September", asOf)).toBe("2026-09-25");
    expect(extractDate("25.09.2026 tarihinde ödenecek", asOf)).toBe("2026-09-25");
    expect(extractDate("in 10 days", asOf)).toBe("2026-09-25");
    expect(extractDate("ay sonuna kadar", asOf)).toBe("2026-09-30");
    expect(extractDate("no date here", asOf)).toBeNull();
  });
});

describe("rule-based classifier", () => {
  const ctx = { asOf, language: "en" as const };
  it("classifies the spec examples", () => {
    expect(classifyWithRules("We will pay next Friday.", ctx)).toMatchObject({ intent: "PAYMENT_DATE_PROMISED", promised_date: "2026-09-25" });
    expect(classifyWithRules("I am waiting for approval from finance.", ctx).intent).toBe("WAITING_FOR_APPROVAL");
    expect(classifyWithRules("We have a cash flow problem.", ctx).intent).toBe("CASH_FLOW_PROBLEM");
    expect(classifyWithRules("We never received the invoice.", ctx).intent).toBe("INVOICE_NOT_RECEIVED");
    expect(classifyWithRules("There is a problem with the shipment.", ctx).intent).toBe("PRODUCT_OR_SHIPMENT_PROBLEM");
    expect(classifyWithRules("Can you give us another 30 days?", ctx)).toMatchObject({ intent: "REQUEST_EXTENSION", requested_extension_days: 30 });
    expect(classifyWithRules("We will not pay this invoice.", ctx).intent).toBe("REFUSAL_TO_PAY");
    expect(classifyWithRules("Ödemeyi haftaya cuma yapacağız.", { asOf, language: "tr" })).toMatchObject({ intent: "PAYMENT_DATE_PROMISED", promised_date: "2026-09-25" });
    expect(classifyWithRules("Faturaya itiraz ediyoruz, tutar hatalı.", { asOf, language: "tr" }).intent).toBe("DISPUTE");
  });
  it("falls back to rules when no model is configured", async () => {
    const c = await classifyReply("Payment was sent yesterday.", ctx, null);
    expect(c.intent).toBe("PAYMENT_CONFIRMED");
    expect(c.engine).toBe("rules");
  });
  it("validates model output and rejects garbage", async () => {
    const c = await classifyReply("We will pay next Friday.", ctx, async () => ({ intent: "NOT_A_REAL_INTENT" }) as never);
    expect(c.engine).toBe("rules");
    const good = await classifyReply("We will pay next Friday.", ctx, async () => ({ intent: "PAYMENT_DATE_PROMISED", confidence: 0.96, promised_date: "2026-09-25", requested_extension_days: null, disputed_amount: null, reason: null, urgency: "LOW", summary: "ok" }));
    expect(good.engine).toBe("llm");
    expect(good.promised_date).toBe("2026-09-25");
  });
});

describe("escalation rules", () => {
  const base = { confidence: 0.95, promised_date: null, requested_extension_days: null, disputed_amount: null, reason: null, urgency: "LOW" as const, requires_human: false, summary: "", engine: "rules" as const };
  it("escalates disputes, refusals, large extensions, legal threats and low confidence", () => {
    expect(evaluateEscalation({ ...base, intent: "DISPUTE" }, { confidenceThreshold: 0.75 }).escalate).toBe(true);
    expect(evaluateEscalation({ ...base, intent: "REFUSAL_TO_PAY" }, { confidenceThreshold: 0.75 }).severity).toBe("CRITICAL");
    expect(evaluateEscalation({ ...base, intent: "REQUEST_EXTENSION", requested_extension_days: 30 }, { confidenceThreshold: 0.75 }).escalate).toBe(true);
    expect(evaluateEscalation({ ...base, intent: "PAYMENT_DATE_PROMISED" }, { confidenceThreshold: 0.75, rawText: "our lawyer will contact you" }).escalate).toBe(true);
    expect(evaluateEscalation({ ...base, intent: "PAYMENT_DATE_PROMISED", confidence: 0.5 }, { confidenceThreshold: 0.75 }).escalate).toBe(true);
    expect(evaluateEscalation({ ...base, intent: "PAYMENT_DATE_PROMISED", promised_date: "2026-09-25" }, { confidenceThreshold: 0.75 }).escalate).toBe(false);
    expect(evaluateEscalation({ ...base, intent: "PAYMENT_DATE_PROMISED", promised_date: "2026-09-25" }, { confidenceThreshold: 0.75, brokenPromiseCount: 2 }).escalate).toBe(true);
  });
});

describe("message generation", () => {
  const facts = { contactName: "Ahmet Yılmaz", customerName: "ABC Teknoloji A.Ş.", companyName: "Demo Teknoloji", invoiceNumber: "INV-2026-00182", amount: 18500, currency: "EUR" as const, dueDate: "2026-09-03", daysOverdue: 12, signature: null };
  it("renders the pre-due Turkish template with facts", () => {
    const m = renderTemplate("PRE_DUE", "POLITE", { ...facts, daysOverdue: 0 }, "tr");
    expect(m.body).toContain("Merhaba Ahmet Yılmaz");
    expect(m.body).toContain("INV-2026-00182");
    expect(m.body).toContain("€18.500,00");
    expect(validateOutboundMessage(m, facts)).toEqual([]);
  });
  it("blocks forbidden phrases and missing facts", () => {
    expect(validateOutboundMessage({ subject: "x", body: "Pay INV-2026-00182 €18.500 or we take legal action" }, facts)).toContain('forbidden phrase: "legal action"');
    expect(validateOutboundMessage({ subject: "x", body: "Please pay." }, facts)).toContain("invoice number missing");
  });
  it("falls back to the template when the model output is unsafe", async () => {
    const bad = await generateMessage({ facts, stage: "OVERDUE_MID", language: "en" }, async () => ({ subject: "Invoice INV-2026-00182", body: "Pay €18500 now or face a lawsuit and interest will accrue on invoice INV-2026-00182.", tone: "FIRM" }));
    expect(bad.generator).toBe("template");
    const good = await generateMessage({ facts, stage: "OVERDUE_MID", language: "en" }, async () => ({ subject: "Invoice INV-2026-00182 – payment date", body: "Dear Ahmet, invoice INV-2026-00182 for €18,500.00 was due on 3 Sep 2026. Could you confirm the payment date? Kind regards, Demo Teknoloji", tone: "FIRM" }));
    expect(good.generator).toBe("llm");
  });
});

describe("risk analyzer", () => {
  const f = (o: Partial<CustomerFinancials>): CustomerFinancials => ({ totalInvoiced: 100000, totalPaid: 26000, outstanding: 74000, overdue: 60000, overdueCount: 4, openCount: 5, averageDelayDays: 24, brokenPromises90d: 2, activePromises: 0, lastPaymentDate: "2026-08-01", nextExpectedPayment: null, disputedCount: 0, currency: "EUR", ...o });
  it("scores the spec example as HIGH with explainable reasons", () => {
    const r = computeRiskScore(f({}), { creditLimit: 80000, locale: "en" });
    expect(r.level === "HIGH" || r.level === "CRITICAL").toBe(true);
    expect(r.reasons.join(" ")).toContain("24 day average payment delay");
    expect(r.reasons.join(" ")).toContain("4 overdue invoices");
    expect(r.reasons.join(" ")).toContain("2 broken payment promises");
  });
  it("scores a clean customer as LOW", () => {
    const r = computeRiskScore(f({ overdue: 0, overdueCount: 0, averageDelayDays: 0, brokenPromises90d: 0, outstanding: 10000 }), { creditLimit: null, locale: "tr" });
    expect(r.level).toBe("LOW");
    expect(r.score).toBeLessThan(35);
  });
});

describe("payment matcher", () => {
  const customers: Customer[] = [{ id: "c1", created_at: "", organization_id: "o", company_name: "ABC Teknoloji A.Ş.", contact_person: null, email: null, phone: null, whatsapp_number: null, country: null, preferred_language: "tr", payment_terms_days: 30, credit_limit: null, currency: "EUR", notes: null, account_manager_id: null, shipments_on_hold: false }];
  const inv = (id: string, num: string, amount: number, currency: "EUR" | "TRY" = "EUR"): Invoice => ({ id, created_at: "", organization_id: "o", customer_id: "c1", invoice_number: num, invoice_date: "2026-08-01", due_date: "2026-09-03", currency, amount, paid_amount: 0, status: "OVERDUE", collection_stage: "OVERDUE_MID", assigned_user_id: null, description: null, last_reminder_stage: null, last_reminder_at: null, updated_at: "", document_path: null, document_name: null, external_ref: null, source: "MANUAL" });
  it("matches by reference tail and exact amount with high confidence", () => {
    const c = suggestMatches({ amount: 18500, currency: "EUR", reference: "ABC-INV182" }, [inv("i1", "INV-2026-00182", 18500), inv("i2", "INV-2026-00196", 21000)], customers, "en");
    expect(c[0].invoice.id).toBe("i1");
    expect(c[0].confidence).toBeGreaterThanOrEqual(0.9);
  });
  it("penalises currency mismatch", () => {
    const c = suggestMatches({ amount: 18500, currency: "TRY", reference: "INV-2026-00182" }, [inv("i1", "INV-2026-00182", 18500)], customers);
    expect(c.length === 0 || c[0].confidence < 0.5).toBe(true);
  });
});
