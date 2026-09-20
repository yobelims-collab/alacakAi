import "server-only";
import type { AppContext } from "@/lib/db";
import { today } from "@/lib/domain/dates";
import { daysOverdue, outstanding } from "@/lib/domain/invoices";
import type { AiAction, Audience, Communication, Customer, Invoice, RiskScore } from "@/lib/types";

/** One routine draft waiting for a click. */
export interface QuickItem {
  comm: Communication;
  customer: Customer;
  invoice: Invoice | null;
  grade: RiskScore | null;
  daysOverdue: number;
  outstanding: number;
  audience: Audience;
}

/** One situation the AI must not decide alone. */
export interface DecisionItem {
  action: AiAction;
  customer: Customer | null;
  invoice: Invoice | null;
  grade: RiskScore | null;
  /** The customer's message that triggered it, if any. */
  inbound: Communication | null;
  /** The AI-prepared answer (with soft/firm alternatives), if any. */
  draft: Communication | null;
  story: string[];
  daysOverdue: number;
  outstanding: number;
  audience: Audience;
}

export interface InboxData {
  quick: QuickItem[];
  decisions: DecisionItem[];
  autoSentToday: number;
  totalWaiting: number;
}

function audienceOf(a: Audience | null, fallback: Audience): Audience {
  return a ?? fallback;
}

/**
 * Builds the inbox for the current user. Finance sees everything; a SALES user sees only the
 * customers they manage. Snoozed drafts are hidden until their date.
 */
export async function loadInbox(ctx: AppContext, opts: { onlyMine?: boolean } = {}): Promise<InboxData> {
  const asOf = today();
  const [comms, actions, customers, invoices, risks] = await Promise.all([
    ctx.store.list("communications"),
    ctx.store.list("ai_actions"),
    ctx.store.list("customers"),
    ctx.store.list("invoices"),
    ctx.store.list("risk_scores"),
  ]);
  const custBy = new Map(customers.map((c) => [c.id, c]));
  const invBy = new Map(invoices.map((i) => [i.id, i]));
  const riskBy = new Map(risks.map((r) => [r.customer_id, r]));
  const commBy = new Map(comms.map((c) => [c.id, c]));

  const isSales = ctx.user.role === "SALES";
  const mine = (customerId: string | null) => {
    if (!customerId) return !isSales;
    const c = custBy.get(customerId);
    return c?.account_manager_id === ctx.user.id;
  };
  const visible = (customerId: string | null, audience: Audience) => {
    if (isSales) return audience !== "FINANCE" && mine(customerId);
    if (opts.onlyMine) return mine(customerId);
    return true;
  };

  // Drafts that belong to a decision card are shown inside the card, not as quick items.
  const decisionDraftIds = new Set(actions.filter((a) => a.status === "NEEDS_HUMAN").map((a) => (a.payload as { draft_id?: string } | null)?.draft_id).filter(Boolean) as string[]);

  const quick: QuickItem[] = comms
    .filter((c) => c.direction === "OUTBOUND" && c.status === "PENDING_APPROVAL" && !decisionDraftIds.has(c.id) && (!c.snoozed_until || c.snoozed_until <= asOf))
    .map((c) => {
      const invoice = c.invoice_id ? (invBy.get(c.invoice_id) ?? null) : null;
      const audience = audienceOf(c.routed_to, "FINANCE");
      return { comm: c, customer: custBy.get(c.customer_id)!, invoice, grade: riskBy.get(c.customer_id) ?? null, daysOverdue: invoice ? Math.max(0, daysOverdue(invoice, asOf)) : 0, outstanding: invoice ? outstanding(invoice) : 0, audience };
    })
    .filter((q) => q.customer && visible(q.customer.id, q.audience))
    .sort((a, b) => b.daysOverdue - a.daysOverdue || b.outstanding - a.outstanding);

  const decisions: DecisionItem[] = actions
    .filter((a) => a.status === "NEEDS_HUMAN")
    .map((a) => {
      const invoice = a.invoice_id ? (invBy.get(a.invoice_id) ?? null) : null;
      const customer = a.customer_id ? (custBy.get(a.customer_id) ?? null) : null;
      const inbound = a.communication_id ? (commBy.get(a.communication_id) ?? null) : null;
      const draftId = (a.payload as { draft_id?: string } | null)?.draft_id ?? null;
      const draft = draftId ? (commBy.get(draftId) ?? null) : null;
      const audience = audienceOf(a.routed_to, "BOTH");
      return {
        action: a,
        customer,
        invoice,
        grade: customer ? (riskBy.get(customer.id) ?? null) : null,
        inbound: inbound?.direction === "INBOUND" ? inbound : null,
        draft: draft?.status === "PENDING_APPROVAL" ? draft : null,
        story: buildStory(a, customer, invoice, comms, ctx.locale, asOf),
        daysOverdue: invoice ? Math.max(0, daysOverdue(invoice, asOf)) : 0,
        outstanding: invoice ? outstanding(invoice) : 0,
        audience,
      };
    })
    .filter((d) => visible(d.customer?.id ?? null, d.audience))
    .sort((a, b) => (a.action.severity === "CRITICAL" ? -1 : 1) - (b.action.severity === "CRITICAL" ? -1 : 1) || b.outstanding - a.outstanding);

  const autoSentToday = comms.filter((c) => c.direction === "OUTBOUND" && c.status.startsWith("SENT") && c.ai_generated && (c.sent_at ?? "").slice(0, 10) === asOf && c.stage === "PRE_DUE").length;
  return { quick, decisions, autoSentToday, totalWaiting: quick.length + decisions.length };
}

/** Three-line history so the human does not have to open the customer page. */
function buildStory(a: AiAction, customer: Customer | null, invoice: Invoice | null, comms: Communication[], locale: "tr" | "en", asOf: string): string[] {
  const tr = locale === "tr";
  const out: string[] = [];
  if (invoice) {
    const sent = comms.filter((c) => c.invoice_id === invoice.id && c.direction === "OUTBOUND" && c.status.startsWith("SENT")).length;
    const d = Math.max(0, daysOverdue(invoice, asOf));
    out.push(tr ? `${invoice.invoice_number}: ${d} gün gecikmiş, ${sent} hatırlatma gönderildi.` : `${invoice.invoice_number}: ${d} days overdue, ${sent} reminder${sent === 1 ? "" : "s"} sent.`);
    const replies = comms.filter((c) => c.invoice_id === invoice.id && c.direction === "INBOUND").sort((x, y) => (x.created_at < y.created_at ? 1 : -1));
    for (const r of replies.slice(0, 2)) {
      out.push(tr ? `${r.created_at.slice(0, 10)}: müşteri "${r.body.slice(0, 90)}${r.body.length > 90 ? "…" : ""}"` : `${r.created_at.slice(0, 10)}: customer wrote "${r.body.slice(0, 90)}${r.body.length > 90 ? "…" : ""}"`);
    }
  }
  if (a.description && !out.some((l) => l.includes(a.description!))) out.push(a.description);
  if (customer?.notes) out.push((tr ? "Not: " : "Note: ") + customer.notes);
  return out.slice(0, 4);
}
