import type { Audience, AutomationRule, CollectionStage, Grade, Locale } from "@/lib/types";

/**
 * Who may send a message, and who must look at it. Pure function so the rule is testable and
 * visible in one place:
 *  - The AI sends on its own ONLY pre-due reminders, and only when the amount is below the
 *    company threshold and the customer is not in the D/E rating bands.
 *  - Everything else is drafted by the AI and waits for a human.
 *  - Finance owns the queue; sales (the account manager) is looped in once the invoice is
 *    overdue for `sales_involved_after_days` or when the item is a decision (dispute, refusal…).
 */
export interface ApprovalInput {
  stage: CollectionStage;
  amountInReportingCurrency: number;
  grade: Grade | null;
  daysOverdue: number;
  isDecision: boolean;
  rules: Pick<AutomationRule, "auto_send_pre_due" | "sales_involved_after_days">;
  approvalAmountThreshold: number;
  locale?: Locale;
}

export interface ApprovalDecision {
  autoSend: boolean;
  audience: Audience;
  /** Why a human has to look (null when auto-sent). */
  reason: string | null;
}

export function decideApproval(i: ApprovalInput): ApprovalDecision {
  const tr = (i.locale ?? "tr") === "tr";
  const reasons: string[] = [];
  const audience: Audience = i.isDecision || i.daysOverdue >= i.rules.sales_involved_after_days ? "BOTH" : "FINANCE";

  if (i.stage !== "PRE_DUE") {
    reasons.push(tr ? "Vade sonrası mesajlar insan onayı ister" : "Messages after the due date need human approval");
  } else if (!i.rules.auto_send_pre_due) {
    reasons.push(tr ? "Otomatik gönderim kapalı" : "Automatic sending is off");
  }
  if (i.amountInReportingCurrency >= i.approvalAmountThreshold) {
    reasons.push(tr ? "Tutar onay eşiğinin üzerinde" : "Amount is above the approval threshold");
  }
  if (i.grade === "D" || i.grade === "E") {
    reasons.push(tr ? `Müşteri derecesi ${i.grade}` : `Customer rating ${i.grade}`);
  }
  if (i.isDecision) reasons.push(tr ? "Karar gerektiren durum" : "Requires a decision");

  return { autoSend: reasons.length === 0, audience, reason: reasons.length ? reasons.join(" · ") : null };
}
