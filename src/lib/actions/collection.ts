"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "@/lib/db";
import { assertCanEdit } from "@/lib/services/team-service";
import { resetDemoData } from "@/lib/db/demo-seed";
import { approveCommunication, approveMany, decideAction, draftReminder, processInboundReply, rejectCommunication, resolveAction, runCollectionCycle, setInvoiceStatus, snoozeCommunication, type CycleSummary, type InboxDecision } from "@/lib/services/collection-service";
import { addDays, today } from "@/lib/domain/dates";
import { CHANNELS, COLLECTION_STAGES, TONES } from "@/lib/types";

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

function revalidateAll() {
  for (const p of ["/inbox", "/dashboard", "/attention", "/customers", "/invoices", "/payments", "/communications", "/ai-actions"]) revalidatePath(p, "layout");
}

function fail(err: unknown): ActionResult<never> {
  return { ok: false, error: err instanceof Error ? err.message : "Unexpected error" };
}

export async function runCycleAction(): Promise<ActionResult<CycleSummary>> {
  try {
    const ctx = await requireContext();
    assertCanEdit(ctx);
    const data = await runCollectionCycle(ctx, { trigger: "manual" });
    revalidateAll();
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

const approveSchema = z.object({ id: z.string().min(1), subject: z.string().trim().min(3).max(200).optional(), body: z.string().trim().min(20).max(2500).optional(), variant: z.enum(["soft", "firm"]).optional() });

export async function approveCommunicationAction(input: { id: string; subject?: string; body?: string; variant?: "soft" | "firm" }): Promise<ActionResult<{ status: string }>> {
  try {
    const parsed = approveSchema.parse(input);
    const ctx = await requireContext();
    assertCanEdit(ctx);
    const comm = await approveCommunication(ctx, parsed.id, { subject: parsed.subject, body: parsed.body, variant: parsed.variant });
    revalidateAll();
    return { ok: true, data: { status: comm.status } };
  } catch (e) {
    return fail(e);
  }
}

export async function rejectCommunicationAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    assertCanEdit(ctx);
    await rejectCommunication(ctx, z.string().min(1).parse(id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const replySchema = z.object({ customerId: z.string().min(1), invoiceId: z.string().optional().nullable(), channel: z.enum(CHANNELS).default("EMAIL"), body: z.string().trim().min(2).max(3000) });

export async function simulateReplyAction(input: { customerId: string; invoiceId?: string | null; channel?: "EMAIL" | "WHATSAPP"; body: string }): Promise<ActionResult<{ intent: string; confidence: number; escalated: boolean; promisedDate: string | null }>> {
  try {
    const parsed = replySchema.parse(input);
    const ctx = await requireContext();
    assertCanEdit(ctx);
    const r = await processInboundReply(ctx, { customerId: parsed.customerId, invoiceId: parsed.invoiceId ?? null, channel: parsed.channel, body: parsed.body, source: "simulated" });
    revalidateAll();
    return { ok: true, data: { intent: r.classification.intent, confidence: r.classification.confidence, escalated: r.escalated, promisedDate: r.promise?.promised_date ?? null } };
  } catch (e) {
    return fail(e);
  }
}

export async function resolveActionAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    assertCanEdit(ctx);
    await resolveAction(ctx, z.string().min(1).parse(id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const draftSchema = z.object({ invoiceId: z.string().min(1), stage: z.enum(COLLECTION_STAGES).optional(), tone: z.enum(TONES).optional(), channel: z.enum(CHANNELS).optional() });

export async function draftReminderAction(input: { invoiceId: string; stage?: string; tone?: string; channel?: string }): Promise<ActionResult<{ communicationId: string; status: string }>> {
  try {
    const parsed = draftSchema.parse(input);
    const ctx = await requireContext();
    assertCanEdit(ctx);
    const inv = await ctx.store.get("invoices", parsed.invoiceId);
    if (!inv) return { ok: false, error: "invoice not found" };
    const comm = await draftReminder(ctx, inv, { stage: parsed.stage, tone: parsed.tone, channel: parsed.channel });
    revalidateAll();
    return { ok: true, data: { communicationId: comm.id, status: comm.status } };
  } catch (e) {
    return fail(e);
  }
}

export async function setInvoiceStatusAction(invoiceId: string, status: "PAID" | "DISPUTED" | "ESCALATED" | "SENT"): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    assertCanEdit(ctx);
    await setInvoiceStatus(ctx, z.string().min(1).parse(invoiceId), z.enum(["PAID", "DISPUTED", "ESCALATED", "SENT"]).parse(status));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function resetDemoAction(): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    assertCanEdit(ctx);
    if (!ctx.org.is_demo && !ctx.demo) return { ok: false, error: "Only available for demo organizations" };
    await resetDemoData(ctx.store, ctx.user.id);
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function approveManyAction(ids: string[]): Promise<ActionResult<{ sent: number; failed: number }>> {
  try {
    const parsed = z.array(z.string().min(1)).min(1).max(100).parse(ids);
    const ctx = await requireContext();
    assertCanEdit(ctx);
    const r = await approveMany(ctx, parsed);
    revalidateAll();
    return { ok: true, data: { sent: r.filter((x) => x.ok).length, failed: r.filter((x) => !x.ok).length } };
  } catch (e) {
    return fail(e);
  }
}

export async function snoozeCommunicationAction(id: string, days = 3): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    assertCanEdit(ctx);
    await snoozeCommunication(ctx, z.string().min(1).parse(id), addDays(today(), z.number().int().min(1).max(30).parse(days)));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const decisionSchema = z.object({ id: z.string().min(1), decision: z.enum(["APPROVE_EXTENSION", "HOLD_SHIPMENTS", "RELEASE_SHIPMENTS", "HANDLE_MYSELF", "RESOLVE"]), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

export async function decideActionAction(input: { id: string; decision: InboxDecision; date?: string }): Promise<ActionResult> {
  try {
    const parsed = decisionSchema.parse(input);
    const ctx = await requireContext();
    assertCanEdit(ctx);
    await decideAction(ctx, parsed.id, parsed.decision, { date: parsed.date });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
