import type { AutomationRule, CollectionStage, Communication, Invoice, PaymentPromise } from "@/lib/types";
import { STAGE_ORDER, isOpen, stageForInvoice } from "@/lib/domain/invoices";
import { daysBetween } from "@/lib/domain/dates";

/**
 * Planning half of the collection engine (pure, fully testable).
 * Given the current state it decides *what* should happen; `collection-service` applies it.
 */
export type PlannedAction =
  | { kind: "REMINDER"; invoice: Invoice; stage: CollectionStage }
  | { kind: "PROMISE_FOLLOW_UP"; invoice: Invoice; promise: PaymentPromise }
  | { kind: "PROMISE_BROKEN"; invoice: Invoice; promise: PaymentPromise }
  | { kind: "ESCALATE"; invoice: Invoice; stage: CollectionStage; reason: string };

export interface PlanInput {
  invoices: Invoice[];
  communications: Communication[];
  promises: PaymentPromise[];
  rules: AutomationRule;
  asOf: string;
  /** Days of grace after a promised date before it counts as broken. */
  promiseGraceDays?: number;
}

function stageEnabled(stage: CollectionStage, rules: AutomationRule): boolean {
  switch (stage) {
    case "PRE_DUE":
      return rules.pre_due_enabled;
    case "DUE_TODAY":
      return rules.due_date_enabled;
    case "OVERDUE_EARLY":
    case "OVERDUE_MID":
      return rules.overdue_enabled;
    case "ESCALATED":
      return true;
    default:
      return false;
  }
}

export function planCollectionCycle(input: PlanInput): PlannedAction[] {
  const { invoices, communications, promises, rules, asOf } = input;
  const grace = input.promiseGraceDays ?? 1;
  const actions: PlannedAction[] = [];

  for (const inv of invoices) {
    if (!isOpen(inv) || inv.status === "DISPUTED") continue;

    const active = promises.find((p) => p.invoice_id === inv.id && p.status === "ACTIVE");
    if (active) {
      const delta = daysBetween(active.promised_date, asOf); // >0 : promised date passed
      if (delta > grace) {
        actions.push({ kind: "PROMISE_BROKEN", invoice: inv, promise: active });
      } else if (delta >= 0) {
        const alreadyFollowedUp = communications.some(
          (c) => c.invoice_id === inv.id && c.direction === "OUTBOUND" && c.stage === "OVERDUE_MID" && c.created_at.slice(0, 10) >= active.promised_date,
        );
        if (!alreadyFollowedUp) actions.push({ kind: "PROMISE_FOLLOW_UP", invoice: inv, promise: active });
      }
      // While a promise is active and not yet due, the AI stays quiet (rule 15: follow the agreed date).
      continue;
    }

    const stage = stageForInvoice(inv, asOf, rules);
    if (stage === "NONE") continue;

    if (stage === "ESCALATED") {
      if (inv.status !== "ESCALATED") {
        actions.push({ kind: "ESCALATE", invoice: inv, stage, reason: `${daysBetween(inv.due_date, asOf)} days overdue` });
      }
      continue;
    }

    if (!stageEnabled(stage, rules)) continue;
    const lastStage = inv.last_reminder_stage;
    if (lastStage && STAGE_ORDER[lastStage] >= STAGE_ORDER[stage]) continue; // already handled this stage
    const pendingDraft = communications.some((c) => c.invoice_id === inv.id && c.direction === "OUTBOUND" && (c.status === "PENDING_APPROVAL" || c.status === "DRAFT"));
    if (pendingDraft) continue; // don't pile drafts on top of an unapproved one
    actions.push({ kind: "REMINDER", invoice: inv, stage });
  }

  return actions;
}
