"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "@/lib/db";
import { resetDemoData } from "@/lib/db/demo-seed";
import { approveCommunication, draftReminder, processInboundReply, rejectCommunication, resolveAction, runCollectionCycle, setInvoiceStatus, type CycleSummary } from "@/lib/services/collection-service";
import { CHANNELS, COLLECTION_STAGES, TONES } from "@/lib/types";

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

function revalidateAll() {
  for (const p of ["/dashboard", "/attention", "/customers", "/invoices", "/payments", "/communications", "/ai-actions"]) revalidatePath(p, "layout");
}

function fail(err: unknown): ActionResult<never> {
  return { ok: false, error: err instanceof Error ? err.message : "Unexpected error" };
}

export async function runCycleAction(): Promise<ActionResult<CycleSummary>> {
  try {
    const ctx = await requireContext();
    const data = await runCollectionCycle(ctx, { trigger: "manual" });
    revalidateAll();
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

const approveSchema = z.object({ id: z.string().min(1), subject: z.string().trim().min(3).max(200).optional(), body: z.string().trim().min(20).max(2500).optional() });

export async function approveCommunicationAction(input: { id: string; subject?: string; body?: string }): Promise<ActionResult<{ status: string }>> {
  try {
    const parsed = approveSchema.parse(input);
    const ctx = await requireContext();
    const comm = await approveCommunication(ctx, parsed.id, { subject: parsed.subject, body: parsed.body });
    revalidateAll();
    return { ok: true, data: { status: comm.status } };
  } catch (e) {
    return fail(e);
  }
}

export async function rejectCommunicationAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
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
    if (!ctx.org.is_demo && !ctx.demo) return { ok: false, error: "Only available for demo organizations" };
    await resetDemoData(ctx.store, ctx.user.id);
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
