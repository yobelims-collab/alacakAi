import "server-only";
import type { AppContext } from "@/lib/db";
import type { DataStore } from "@/lib/db/store";
import { planCollectionCycle, type PlannedAction } from "@/lib/ai/collection-agent";
import { evaluateEscalation } from "@/lib/ai/escalation-rules";
import { generateMessage, validateOutboundMessage } from "@/lib/ai/message-generator";
import { classifyReply } from "@/lib/ai/response-classifier";
import type { TemplateFacts } from "@/lib/ai/templates";
import { addDays, daysBetween, formatDate, today } from "@/lib/domain/dates";
import { daysOverdue, deriveStatus, outstanding, stageForInvoice } from "@/lib/domain/invoices";
import { formatMoney } from "@/lib/domain/money";
import type { AutomationRule, Channel, Classification, CollectionStage, Communication, Customer, Invoice, Locale, Organization, PaymentPromise, Tone } from "@/lib/types";
import { audit } from "./audit";
import { classifierLlm, messageLlm } from "./llm";
import { sendMessage } from "./messaging";
import { recomputeRisk } from "./risk-service";

export const DEFAULT_AUTOMATION: Omit<AutomationRule, "id" | "created_at" | "organization_id"> = {
  pre_due_enabled: true,
  pre_due_days: 3,
  due_date_enabled: true,
  overdue_enabled: true,
  first_reminder_days: 1,
  second_reminder_days: 7,
  escalation_days: 30,
  channels: ["EMAIL"],
  require_approval: true,
};

export async function getAutomationRules(store: DataStore): Promise<AutomationRule> {
  const existing = (await store.list("automation_rules", { limit: 1 }))[0];
  if (existing) return existing;
  return store.insert("automation_rules", DEFAULT_AUTOMATION);
}

function factsFor(inv: Invoice, customer: Customer, org: Organization, asOf: string, promise?: PaymentPromise | null): TemplateFacts {
  return {
    contactName: customer.contact_person,
    customerName: customer.company_name,
    companyName: org.name,
    invoiceNumber: inv.invoice_number,
    amount: outstanding(inv),
    currency: inv.currency,
    dueDate: inv.due_date,
    daysOverdue: Math.max(0, daysOverdue(inv, asOf)),
    promisedDate: promise?.promised_date ?? null,
    signature: org.ai_signature,
  };
}

function primaryChannel(rules: AutomationRule, customer: Customer): Channel {
  if (rules.channels.includes("WHATSAPP") && !rules.channels.includes("EMAIL")) return "WHATSAPP";
  if (rules.channels.includes("EMAIL") && customer.email) return "EMAIL";
  if (rules.channels.includes("WHATSAPP") && customer.whatsapp_number) return "WHATSAPP";
  return rules.channels[0] ?? "EMAIL";
}

/** Builds a short history digest for the generator (never includes risk scores). */
function historyFor(inv: Invoice, comms: Communication[], promises: PaymentPromise[], locale: Locale): string[] {
  const out: string[] = [];
  for (const p of promises.filter((p) => p.invoice_id === inv.id)) {
    out.push(`Promised payment on ${formatDate(p.promised_date, locale)} (${p.status.toLowerCase()})`);
  }
  const inbound = comms.filter((c) => c.invoice_id === inv.id && c.direction === "INBOUND").slice(0, 3);
  for (const c of inbound) out.push(`Customer said: "${c.body.slice(0, 140)}" → ${c.classification?.intent ?? "unclassified"}`);
  const sent = comms.filter((c) => c.invoice_id === inv.id && c.direction === "OUTBOUND" && c.status.startsWith("SENT")).length;
  if (sent) out.push(`${sent} reminder(s) already sent`);
  return out;
}

export interface DraftOptions {
  stage?: CollectionStage;
  tone?: Tone;
  promise?: PaymentPromise | null;
  autoSend?: boolean;
  channel?: Channel;
}

/** Creates an outbound draft (or sends it when approval is not required). Returns the communication. */
export async function draftReminder(ctx: AppContext, inv: Invoice, opts: DraftOptions = {}): Promise<Communication> {
  const { store, org } = ctx;
  const asOf = today();
  const customer = await store.get("customers", inv.customer_id);
  if (!customer) throw new Error("customer not found");
  const rules = await getAutomationRules(store);
  const [comms, promises] = await Promise.all([
    store.list("communications", { where: { customer_id: customer.id } }),
    store.list("payment_promises", { where: { invoice_id: inv.id } }),
  ]);
  const stage = opts.stage ?? (inv.collection_stage === "NONE" ? "OVERDUE_EARLY" : inv.collection_stage);
  const language = customer.preferred_language;
  const facts = factsFor(inv, customer, org, asOf, opts.promise);
  const generated = await generateMessage(
    { facts, stage, language, tone: opts.tone ?? (stage === "PRE_DUE" || stage === "DUE_TODAY" ? "POLITE" : org.ai_default_tone), history: historyFor(inv, comms, promises, language), promiseFollowUp: Boolean(opts.promise) },
    messageLlm(),
  );
  const channel = opts.channel ?? primaryChannel(rules, customer);
  const requireApproval = !(opts.autoSend ?? (org.ai_auto_send && !rules.require_approval));

  const comm = await store.insert("communications", {
    customer_id: customer.id,
    invoice_id: inv.id,
    channel,
    direction: "OUTBOUND",
    subject: generated.subject,
    body: generated.body,
    language,
    stage,
    tone: generated.tone,
    status: requireApproval ? "PENDING_APPROVAL" : "DRAFT",
    classification: null,
    ai_generated: true,
    generator: generated.generator,
    sent_at: null,
    provider_message_id: null,
    next_action_at: null,
    next_action_note: null,
  });

  await store.update("invoices", inv.id, { last_reminder_stage: stage, last_reminder_at: new Date().toISOString(), collection_stage: stage, updated_at: new Date().toISOString() });

  if (requireApproval) {
    await store.insert("ai_actions", {
      customer_id: customer.id,
      invoice_id: inv.id,
      communication_id: comm.id,
      type: "REMINDER_DRAFTED",
      status: "PENDING_APPROVAL",
      severity: "INFO",
      title: `${ctx.t.actionType.REMINDER_DRAFTED}: ${customer.company_name} · ${inv.invoice_number}`,
      description: `${ctx.t.stage[stage]} · ${formatMoney(outstanding(inv), inv.currency, ctx.locale)}`,
      recommended_action: null,
      payload: { stage, generator: generated.generator },
      resolved_at: null,
      resolved_by: null,
    });
    return comm;
  }
  return dispatchCommunication(ctx, comm, null);
}

/** Sends (or simulates sending) a communication and records the AI action. */
export async function dispatchCommunication(ctx: AppContext, comm: Communication, userId: string | null): Promise<Communication> {
  const { store, org } = ctx;
  const customer = await store.get("customers", comm.customer_id);
  const problems = validateOutboundMessage({ subject: comm.subject ?? "", body: comm.body }, {
    contactName: null,
    customerName: customer?.company_name ?? "",
    companyName: org.name,
    invoiceNumber: comm.invoice_id ? ((await store.get("invoices", comm.invoice_id))?.invoice_number ?? "") : "",
    amount: 0,
    currency: "TRY",
    dueDate: today(),
    daysOverdue: 0,
  }).filter((p) => p.startsWith("forbidden"));
  if (problems.length) throw new Error(`Message blocked by safety rules: ${problems.join(", ")}`);

  const result = await sendMessage({
    channel: comm.channel,
    to: comm.channel === "EMAIL" ? (customer?.email ?? null) : (customer?.whatsapp_number ?? null),
    subject: comm.subject,
    body: comm.body,
    fromName: org.sender_name,
    fromEmail: org.sender_email,
  });
  const sentAt = new Date().toISOString();
  const updated = await store.update("communications", comm.id, {
    status: result.status,
    sent_at: result.status === "FAILED" ? null : sentAt,
    provider_message_id: result.providerMessageId,
    next_action_at: addDays(today(), 3),
    next_action_note: ctx.locale === "tr" ? "Yanıt gelmezse takip" : "Follow up if no reply",
  });

  // Close the pending-approval action (if any) and log the send.
  const pending = await store.list("ai_actions", { where: { communication_id: comm.id, status: "PENDING_APPROVAL" } });
  for (const a of pending) await store.update("ai_actions", a.id, { status: "COMPLETED", resolved_at: sentAt, resolved_by: userId });
  await store.insert("ai_actions", {
    customer_id: comm.customer_id,
    invoice_id: comm.invoice_id,
    communication_id: comm.id,
    type: "REMINDER_SENT",
    status: result.status === "FAILED" ? "NEEDS_HUMAN" : "COMPLETED",
    severity: result.status === "FAILED" ? "WARNING" : "SUCCESS",
    title: `${ctx.t.actionType.REMINDER_SENT}: ${customer?.company_name ?? ""}${result.status === "SENT_SIMULATED" ? ` (${ctx.t.common.simulated})` : ""}`,
    description: result.note,
    recommended_action: result.status === "FAILED" ? (ctx.locale === "tr" ? "Müşteri iletişim bilgisini kontrol edin." : "Check the customer's contact details.") : null,
    payload: { channel: comm.channel, provider_status: result.status },
    resolved_at: null,
    resolved_by: null,
  });
  await audit(store, { user_id: userId, action: "communication.sent", entity_type: "communication", entity_id: comm.id, details: { status: result.status } });
  return updated;
}

export async function approveCommunication(ctx: AppContext, commId: string, edits?: { subject?: string; body?: string }): Promise<Communication> {
  const comm = await ctx.store.get("communications", commId);
  if (!comm || comm.direction !== "OUTBOUND") throw new Error("communication not found");
  if (comm.status !== "PENDING_APPROVAL" && comm.status !== "DRAFT") throw new Error("communication is not awaiting approval");
  let target = comm;
  if (edits && (edits.subject !== undefined || edits.body !== undefined)) {
    target = await ctx.store.update("communications", commId, { subject: edits.subject ?? comm.subject, body: edits.body ?? comm.body, generator: "human", ai_generated: false });
  }
  return dispatchCommunication(ctx, target, ctx.user.id);
}

export async function rejectCommunication(ctx: AppContext, commId: string): Promise<void> {
  const comm = await ctx.store.get("communications", commId);
  if (!comm) throw new Error("communication not found");
  await ctx.store.update("communications", commId, { status: "REJECTED" });
  const pending = await ctx.store.list("ai_actions", { where: { communication_id: commId, status: "PENDING_APPROVAL" } });
  for (const a of pending) await ctx.store.update("ai_actions", a.id, { status: "REJECTED", resolved_at: new Date().toISOString(), resolved_by: ctx.user.id });
  if (comm.invoice_id) {
    const inv = await ctx.store.get("invoices", comm.invoice_id);
    // Allow the engine to retry this stage later if the operator rejected the draft.
    if (inv && inv.last_reminder_stage === comm.stage) await ctx.store.update("invoices", inv.id, { last_reminder_stage: null });
  }
  await audit(ctx.store, { user_id: ctx.user.id, action: "communication.rejected", entity_type: "communication", entity_id: commId });
}

export interface CycleSummary {
  drafted: number;
  sent: number;
  escalated: number;
  promisesBroken: number;
  followUps: number;
  statusUpdates: number;
}

/**
 * One pass of the collection engine for the organization: refresh date-driven statuses,
 * plan actions, draft/send reminders, escalate, and mark broken promises.
 * Idempotent per stage: running it twice on the same day does not duplicate reminders.
 */
export async function runCollectionCycle(ctx: AppContext, opts: { trigger: "manual" | "cron" } = { trigger: "manual" }): Promise<CycleSummary> {
  const { store } = ctx;
  const asOf = today();
  const rules = await getAutomationRules(store);
  const [invoices, communications, promises] = await Promise.all([
    store.list("invoices"),
    store.list("communications"),
    store.list("payment_promises"),
  ]);
  const summary: CycleSummary = { drafted: 0, sent: 0, escalated: 0, promisesBroken: 0, followUps: 0, statusUpdates: 0 };

  // 1. Refresh date-driven statuses and stages so the UI reflects the calendar.
  for (const inv of invoices) {
    const status = deriveStatus(inv, asOf);
    const stage = stageForInvoice(inv, asOf, rules);
    if (status !== inv.status || stage !== inv.collection_stage) {
      if (status !== inv.status) summary.statusUpdates += 1;
      Object.assign(inv, await store.update("invoices", inv.id, { status, collection_stage: stage, updated_at: new Date().toISOString() }));
    }
  }

  // 2. Plan and apply.
  const actions: PlannedAction[] = planCollectionCycle({ invoices, communications, promises, rules, asOf });
  for (const a of actions) {
    switch (a.kind) {
      case "REMINDER": {
        const comm = await draftReminder(ctx, a.invoice, { stage: a.stage });
        if (comm.status === "PENDING_APPROVAL") summary.drafted += 1;
        else summary.sent += 1;
        break;
      }
      case "PROMISE_FOLLOW_UP": {
        const comm = await draftReminder(ctx, a.invoice, { stage: "OVERDUE_MID", promise: a.promise });
        summary.followUps += 1;
        if (comm.status === "PENDING_APPROVAL") summary.drafted += 1;
        break;
      }
      case "PROMISE_BROKEN": {
        await markPromiseBroken(ctx, a.promise, a.invoice);
        summary.promisesBroken += 1;
        break;
      }
      case "ESCALATE": {
        await escalateInvoice(ctx, a.invoice, a.reason, null);
        summary.escalated += 1;
        break;
      }
    }
  }

  await audit(store, { user_id: opts.trigger === "manual" ? ctx.user.id : null, action: "collection.cycle", entity_type: "organization", entity_id: ctx.org.id, details: { ...summary, trigger: opts.trigger } });
  return summary;
}

export async function escalateInvoice(ctx: AppContext, inv: Invoice, reason: string, userId: string | null, recommended?: string | null): Promise<void> {
  const customer = await ctx.store.get("customers", inv.customer_id);
  await ctx.store.update("invoices", inv.id, { status: "ESCALATED", collection_stage: "ESCALATED", updated_at: new Date().toISOString() });
  await ctx.store.insert("ai_actions", {
    customer_id: inv.customer_id,
    invoice_id: inv.id,
    communication_id: null,
    type: "ESCALATION",
    status: "NEEDS_HUMAN",
    severity: "CRITICAL",
    title: `${ctx.t.actionType.ESCALATION}: ${customer?.company_name ?? ""} · ${inv.invoice_number}`,
    description: reason,
    recommended_action: recommended ?? (ctx.locale === "tr" ? "Hesap yöneticisi müşteriyle ödeme planını görüşmeli." : "Account manager should agree a payment plan with the customer."),
    payload: { days_overdue: daysOverdue(inv, today()), outstanding: outstanding(inv), currency: inv.currency },
    resolved_at: null,
    resolved_by: null,
  });
  await audit(ctx.store, { user_id: userId, action: "invoice.escalated", entity_type: "invoice", entity_id: inv.id, details: { reason } });
  if (customer) await refreshCustomerRisk(ctx, customer);
}

async function markPromiseBroken(ctx: AppContext, promise: PaymentPromise, inv: Invoice): Promise<void> {
  const customer = await ctx.store.get("customers", inv.customer_id);
  await ctx.store.update("payment_promises", promise.id, { status: "BROKEN", resolved_at: new Date().toISOString() });
  await ctx.store.update("invoices", inv.id, { status: "OVERDUE", updated_at: new Date().toISOString() });
  await ctx.store.insert("ai_actions", {
    customer_id: inv.customer_id,
    invoice_id: inv.id,
    communication_id: null,
    type: "PROMISE_BROKEN",
    status: "NEEDS_HUMAN",
    severity: "CRITICAL",
    title: `${ctx.t.actionType.PROMISE_BROKEN}: ${customer?.company_name ?? ""} · ${inv.invoice_number}`,
    description: ctx.locale === "tr" ? `${formatDate(promise.promised_date, "tr")} için verilen ödeme sözü tutulmadı.` : `Payment promised for ${formatDate(promise.promised_date, "en")} was not kept.`,
    recommended_action: ctx.locale === "tr" ? "Müşteriyi arayın; yeni sözü kabul etmeden önce kredi riskini gözden geçirin." : "Call the customer; review credit exposure before accepting a new promise.",
    payload: { promise_id: promise.id, promised_date: promise.promised_date },
    resolved_at: null,
    resolved_by: null,
  });
  if (customer) await refreshCustomerRisk(ctx, customer);
}

export async function refreshCustomerRisk(ctx: AppContext, customer: Customer): Promise<void> {
  const [invoices, payments, promises] = await Promise.all([
    ctx.store.list("invoices", { where: { customer_id: customer.id } }),
    ctx.store.list("payments", { where: { customer_id: customer.id } }),
    ctx.store.list("payment_promises", { where: { customer_id: customer.id } }),
  ]);
  await recomputeRisk(ctx.store, customer, { invoices, payments, promises }, today(), ctx.locale);
}

export interface InboundResult {
  communication: Communication;
  classification: Classification;
  promise: PaymentPromise | null;
  escalated: boolean;
}

/**
 * Handles a customer reply end-to-end: store it, classify it (LLM or rules), apply escalation
 * rules, record structured promises, and update the invoice — all from validated data only.
 */
export async function processInboundReply(ctx: AppContext, input: { customerId: string; invoiceId: string | null; channel: Channel; body: string; source: "simulated" | "webhook" | "manual" }): Promise<InboundResult> {
  const { store, org } = ctx;
  const asOf = today();
  const customer = await store.get("customers", input.customerId);
  if (!customer) throw new Error("customer not found");
  let invoice = input.invoiceId ? await store.get("invoices", input.invoiceId) : null;
  if (!invoice) {
    // Attach to the oldest open invoice of the customer when the reply does not name one.
    const open = (await store.list("invoices", { where: { customer_id: customer.id }, orderBy: "due_date", ascending: true })).filter((i) => outstanding(i) > 0 && i.status !== "DRAFT");
    invoice = open[0] ?? null;
  }

  const classification = await classifyReply(
    input.body,
    { asOf, language: customer.preferred_language, invoiceNumber: invoice?.invoice_number, amount: invoice ? outstanding(invoice) : undefined, currency: invoice?.currency, dueDate: invoice?.due_date },
    classifierLlm(),
  );
  const promises = await store.list("payment_promises", { where: { customer_id: customer.id } });
  const brokenCount = promises.filter((p) => p.status === "BROKEN").length;
  const decision = evaluateEscalation(classification, { confidenceThreshold: org.ai_confidence_threshold, brokenPromiseCount: brokenCount, locale: ctx.locale, rawText: input.body });
  const finalClassification: Classification = { ...classification, requires_human: decision.escalate };

  const nextAction = nextActionFor(finalClassification, decision.escalate, asOf, ctx.locale);
  const comm = await store.insert("communications", {
    customer_id: customer.id,
    invoice_id: invoice?.id ?? null,
    channel: input.channel,
    direction: "INBOUND",
    subject: null,
    body: input.body,
    language: customer.preferred_language,
    stage: invoice?.collection_stage ?? null,
    tone: null,
    status: "RECEIVED",
    classification: finalClassification,
    ai_generated: false,
    generator: null,
    sent_at: new Date().toISOString(),
    provider_message_id: input.source === "simulated" ? "simulated" : null,
    next_action_at: nextAction.at,
    next_action_note: nextAction.note,
  });

  await store.insert("ai_actions", {
    customer_id: customer.id,
    invoice_id: invoice?.id ?? null,
    communication_id: comm.id,
    type: "REPLY_CLASSIFIED",
    status: "COMPLETED",
    severity: "INFO",
    title: `${ctx.t.actionType.REPLY_CLASSIFIED}: ${customer.company_name} → ${ctx.t.intent[finalClassification.intent]}`,
    description: `${finalClassification.summary} (${Math.round(finalClassification.confidence * 100)}%, ${finalClassification.engine})`,
    recommended_action: null,
    payload: { intent: finalClassification.intent, confidence: finalClassification.confidence, engine: finalClassification.engine },
    resolved_at: null,
    resolved_by: null,
  });

  let promise: PaymentPromise | null = null;
  const canRecordPromise = invoice && finalClassification.promised_date && (finalClassification.intent === "PAYMENT_DATE_PROMISED" || finalClassification.intent === "WAITING_FOR_APPROVAL") && finalClassification.confidence >= org.ai_confidence_threshold;
  if (canRecordPromise && invoice && finalClassification.promised_date) {
    // Supersede any earlier active promise for this invoice.
    for (const p of promises.filter((p) => p.invoice_id === invoice!.id && p.status === "ACTIVE")) {
      await store.update("payment_promises", p.id, { status: "CANCELLED", resolved_at: new Date().toISOString() });
    }
    promise = await store.insert("payment_promises", {
      customer_id: customer.id,
      invoice_id: invoice.id,
      promised_date: finalClassification.promised_date,
      amount: outstanding(invoice),
      currency: invoice.currency,
      status: "ACTIVE",
      source_communication_id: comm.id,
      notes: finalClassification.summary,
      resolved_at: null,
    });
    await store.update("invoices", invoice.id, { status: "PAYMENT_PROMISED", updated_at: new Date().toISOString() });
    await store.insert("ai_actions", {
      customer_id: customer.id,
      invoice_id: invoice.id,
      communication_id: comm.id,
      type: "PROMISE_RECORDED",
      status: "COMPLETED",
      severity: "SUCCESS",
      title: `${ctx.t.actionType.PROMISE_RECORDED}: ${customer.company_name} · ${formatDate(finalClassification.promised_date, ctx.locale)}`,
      description: `${invoice.invoice_number} · ${formatMoney(outstanding(invoice), invoice.currency, ctx.locale)}`,
      recommended_action: null,
      payload: { promise_id: promise.id, promised_date: promise.promised_date },
      resolved_at: null,
      resolved_by: null,
    });
  }

  if (finalClassification.intent === "DISPUTE" && invoice) {
    await store.update("invoices", invoice.id, { status: "DISPUTED", updated_at: new Date().toISOString() });
  }

  if (decision.escalate) {
    await store.insert("ai_actions", {
      customer_id: customer.id,
      invoice_id: invoice?.id ?? null,
      communication_id: comm.id,
      type: "ESCALATION",
      status: "NEEDS_HUMAN",
      severity: decision.severity,
      title: `${customer.company_name}: ${ctx.t.intent[finalClassification.intent]}`,
      description: decision.reasons.join(" · "),
      recommended_action: decision.recommendedAction,
      payload: { intent: finalClassification.intent, reasons: decision.reasons, invoice_number: invoice?.invoice_number ?? null, outstanding: invoice ? outstanding(invoice) : null, currency: invoice?.currency ?? null },
      resolved_at: null,
      resolved_by: null,
    });
  }

  await audit(store, { user_id: ctx.user.id, action: "communication.inbound", entity_type: "communication", entity_id: comm.id, details: { intent: finalClassification.intent, source: input.source } });
  await refreshCustomerRisk(ctx, customer);
  return { communication: comm, classification: finalClassification, promise, escalated: decision.escalate };
}

function nextActionFor(c: Classification, escalated: boolean, asOf: string, locale: Locale): { at: string | null; note: string | null } {
  const tr = locale === "tr";
  if (escalated) return { at: asOf, note: tr ? "İnsan incelemesi bekleniyor" : "Awaiting human review" };
  switch (c.intent) {
    case "PAYMENT_DATE_PROMISED":
    case "WAITING_FOR_APPROVAL":
      if (c.promised_date) return { at: c.promised_date, note: tr ? `${formatDate(c.promised_date, "tr")} tarihinde takip` : `Follow up on ${formatDate(c.promised_date, "en")}` };
      return { at: addDays(asOf, 2), note: tr ? "Kesin tarih için takip" : "Follow up for a firm date" };
    case "PAYMENT_CONFIRMED":
      return { at: addDays(asOf, 2), note: tr ? "Banka hareketlerinde ödemeyi doğrula" : "Verify the payment in bank transactions" };
    case "INVOICE_NOT_RECEIVED":
      return { at: asOf, note: tr ? "Faturayı yeniden gönder" : "Resend the invoice" };
    default:
      return { at: addDays(asOf, 3), note: tr ? "Takip" : "Follow up" };
  }
}

export async function resolveAction(ctx: AppContext, actionId: string): Promise<void> {
  const action = await ctx.store.get("ai_actions", actionId);
  if (!action) throw new Error("action not found");
  await ctx.store.update("ai_actions", actionId, { status: "RESOLVED", resolved_at: new Date().toISOString(), resolved_by: ctx.user.id });
  await audit(ctx.store, { user_id: ctx.user.id, action: "ai_action.resolved", entity_type: "ai_action", entity_id: actionId });
}

/** Human overrides on invoice status (from the invoice page). */
export async function setInvoiceStatus(ctx: AppContext, invoiceId: string, status: "PAID" | "DISPUTED" | "ESCALATED" | "SENT"): Promise<void> {
  const inv = await ctx.store.get("invoices", invoiceId);
  if (!inv) throw new Error("invoice not found");
  if (status === "ESCALATED") {
    await escalateInvoice(ctx, inv, ctx.locale === "tr" ? "Kullanıcı tarafından eskale edildi" : "Escalated by user", ctx.user.id);
    return;
  }
  const patch: Partial<Invoice> = { status, updated_at: new Date().toISOString() };
  if (status === "PAID") patch.paid_amount = inv.amount;
  if (status === "SENT") patch.collection_stage = "NONE";
  await ctx.store.update("invoices", invoiceId, patch);
  if (status === "PAID") {
    for (const p of await ctx.store.list("payment_promises", { where: { invoice_id: invoiceId, status: "ACTIVE" } })) {
      await ctx.store.update("payment_promises", p.id, { status: "KEPT", resolved_at: new Date().toISOString() });
    }
  }
  await ctx.store.insert("ai_actions", {
    customer_id: inv.customer_id,
    invoice_id: inv.id,
    communication_id: null,
    type: "INVOICE_STATUS_CHANGED",
    status: "COMPLETED",
    severity: "INFO",
    title: `${ctx.t.actionType.INVOICE_STATUS_CHANGED}: ${inv.invoice_number} → ${ctx.t.status[status]}`,
    description: ctx.user.full_name,
    recommended_action: null,
    payload: { from: inv.status, to: status, by: ctx.user.id },
    resolved_at: null,
    resolved_by: null,
  });
  await audit(ctx.store, { user_id: ctx.user.id, action: "invoice.status", entity_type: "invoice", entity_id: invoiceId, details: { from: inv.status, to: status } });
  const customer = await ctx.store.get("customers", inv.customer_id);
  if (customer) await refreshCustomerRisk(ctx, customer);
}

export { daysBetween };
