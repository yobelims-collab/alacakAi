import { describe, expect, it } from "vitest";
import { decideApproval } from "@/lib/ai/approval-policy";
import { gradeForScore, plainFacts } from "@/lib/ai/risk-analyzer";
import { renderReplyAlternatives } from "@/lib/ai/reply-templates";
import { validateOutboundMessage } from "@/lib/ai/message-generator";
import type { CustomerFinancials } from "@/lib/domain/metrics";

const rules = { auto_send_pre_due: true, sales_involved_after_days: 14 };

describe("approval policy", () => {
  it("auto-sends only pre-due reminders under the threshold for A–C customers", () => {
    expect(decideApproval({ stage: "PRE_DUE", amountInReportingCurrency: 50000, grade: "B", daysOverdue: 0, isDecision: false, rules, approvalAmountThreshold: 250000 })).toMatchObject({ autoSend: true, audience: "FINANCE", reason: null });
    expect(decideApproval({ stage: "PRE_DUE", amountInReportingCurrency: 300000, grade: "A", daysOverdue: 0, isDecision: false, rules, approvalAmountThreshold: 250000 }).autoSend).toBe(false);
    expect(decideApproval({ stage: "PRE_DUE", amountInReportingCurrency: 1000, grade: "D", daysOverdue: 0, isDecision: false, rules, approvalAmountThreshold: 250000 }).autoSend).toBe(false);
    expect(decideApproval({ stage: "PRE_DUE", amountInReportingCurrency: 1000, grade: "A", daysOverdue: 0, isDecision: false, rules: { ...rules, auto_send_pre_due: false }, approvalAmountThreshold: 250000 }).autoSend).toBe(false);
  });
  it("everything after the due date waits for a human; sales joins after N days or on decisions", () => {
    const early = decideApproval({ stage: "OVERDUE_EARLY", amountInReportingCurrency: 1000, grade: "A", daysOverdue: 3, isDecision: false, rules, approvalAmountThreshold: 250000 });
    expect(early.autoSend).toBe(false);
    expect(early.audience).toBe("FINANCE");
    expect(decideApproval({ stage: "OVERDUE_MID", amountInReportingCurrency: 1000, grade: "A", daysOverdue: 15, isDecision: false, rules, approvalAmountThreshold: 250000 }).audience).toBe("BOTH");
    expect(decideApproval({ stage: "OVERDUE_EARLY", amountInReportingCurrency: 1000, grade: "A", daysOverdue: 2, isDecision: true, rules, approvalAmountThreshold: 250000 }).audience).toBe("BOTH");
  });
});

describe("grade", () => {
  it("maps score bands to letters", () => {
    expect(gradeForScore(0)).toBe("A");
    expect(gradeForScore(15)).toBe("A");
    expect(gradeForScore(16)).toBe("B");
    expect(gradeForScore(35)).toBe("B");
    expect(gradeForScore(60)).toBe("C");
    expect(gradeForScore(61)).toBe("D");
    expect(gradeForScore(86)).toBe("E");
  });
  it("explains the rating in plain language", () => {
    const f: CustomerFinancials = { totalInvoiced: 100, totalPaid: 50, outstanding: 50, overdue: 20, overdueCount: 1, openCount: 2, averageDelayDays: 12, brokenPromises90d: 1, activePromises: 0, lastPaymentDate: "2026-09-01", nextExpectedPayment: null, disputedCount: 0, currency: "TRY" };
    const facts = plainFacts(f, "en");
    expect(facts[0]).toBe("Pays on average 12 days after the due date.");
    expect(facts.join(" ")).toContain("Broke 1 payment promise");
  });
});

describe("reply drafts", () => {
  const facts = { contactName: "Ahmet Yılmaz", customerName: "ABC", companyName: "Demo", invoiceNumber: "INV-2026-00182", amount: 18500, currency: "EUR" as const, dueDate: "2026-09-03", daysOverdue: 12, signature: null };
  it("produce two safe wordings for every intent", () => {
    for (const intent of ["PAYMENT_DATE_PROMISED", "WAITING_FOR_APPROVAL", "PAYMENT_CONFIRMED", "INVOICE_NOT_RECEIVED", "REQUEST_EXTENSION", "CASH_FLOW_PROBLEM", "DISPUTE", "PRODUCT_OR_SHIPMENT_PROBLEM", "REFUSAL_TO_PAY", "WRONG_CONTACT", "OTHER"] as const) {
      for (const locale of ["tr", "en"] as const) {
        const alt = renderReplyAlternatives(intent, facts, locale, { promisedDate: "2026-09-25", extensionDays: 30 });
        // Replies must never contain forbidden language; mentioning the amount is optional for answers.
        expect(validateOutboundMessage(alt.soft, facts).filter((p) => p.startsWith("forbidden"))).toEqual([]);
        expect(validateOutboundMessage(alt.firm, facts).filter((p) => p.startsWith("forbidden"))).toEqual([]);
        expect(alt.soft.body).toContain("INV-2026-00182");
        expect(alt.soft.body).not.toBe(alt.firm.body);
      }
    }
  });
});
