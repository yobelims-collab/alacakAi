import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  decodeDataUri,
  extractReplyText,
  findInvoiceNumber,
  htmlToText,
  organizationFromRecipients,
  parseAddress,
  verifySvixSignature,
} from "@/lib/domain/inbound-email";
import { processInboundReply } from "@/lib/services/collection-service";
import { systemContextFor } from "@/lib/services/system-context";

export const dynamic = "force-dynamic";

/**
 * Resend inbound adapter: POST /api/inbound/resend (webhook event "email.received").
 * 1. Verifies the Svix signature with RESEND_WEBHOOK_SECRET.
 * 2. Finds the organization from the reply+<orgId>@INBOUND_EMAIL_DOMAIN recipient.
 * 3. Fetches the body from Resend (webhooks carry metadata only), strips quoted history.
 * 4. Matches the sender to a customer/contact and hands the text to processInboundReply,
 *    which classifies it and puts a reply draft in the Inbox for human approval.
 * Non-actionable mail is acknowledged with 200 so Resend does not retry it forever.
 */
const eventSchema = z.object({
  type: z.string(),
  data: z
    .object({
      email_id: z.string().min(1).max(200),
      from: z.string().max(400),
      to: z.array(z.string().max(400)).max(50).default([]),
      cc: z.array(z.string().max(400)).max(50).nullish(),
      received_for: z.array(z.string().max(400)).max(50).nullish(),
      subject: z.string().max(1000).nullish(),
    })
    .passthrough(),
});

const receivedSchema = z.object({
  text: z.string().nullish(),
  html: z.string().nullish(),
  subject: z.string().nullish(),
});

/** Svix retries a delivery with the same id; remember recent ids so a retry is not processed twice. */
const seen = new Map<string, number>();
function alreadySeen(id: string): boolean {
  const now = Date.now();
  for (const [k, at] of seen) if (now - at > 3_600_000) seen.delete(k);
  if (seen.has(id)) return true;
  seen.set(id, now);
  return false;
}

const ignored = (reason: string) => NextResponse.json({ ok: true, ignored: reason });

export async function POST(req: NextRequest) {
  const rl = rateLimit(`inbound-resend:${clientIp(req.headers)}`, 120, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "rate limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  if (!env.resendWebhookSecret || !env.inboundEmailDomain) return NextResponse.json({ error: "inbound email not configured" }, { status: 503 });

  const raw = await req.text();
  if (raw.length > 256_000) return NextResponse.json({ error: "payload too large" }, { status: 413 });
  const svix = { id: req.headers.get("svix-id"), timestamp: req.headers.get("svix-timestamp"), signature: req.headers.get("svix-signature") };
  if (!verifySvixSignature(env.resendWebhookSecret, svix, raw)) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const event = eventSchema.safeParse(json);
  if (!event.success) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  if (event.data.type !== "email.received") return ignored("event type");
  if (svix.id && alreadySeen(svix.id)) return ignored("duplicate delivery");

  const d = event.data.data;
  const orgId = organizationFromRecipients([...(d.received_for ?? []), ...d.to, ...(d.cc ?? [])], env.inboundEmailDomain);
  if (!orgId) return ignored("no reply+ recipient");
  const ctx = await systemContextFor(orgId);
  if (!ctx) return ignored("organization not found");

  const sender = parseAddress(d.from).email;
  const [customers, contacts] = await Promise.all([ctx.store.list("customers"), ctx.store.list("customer_contacts")]);
  const customerId =
    customers.find((c) => (c.email ?? "").toLowerCase() === sender)?.id ??
    contacts.find((c) => (c.email ?? "").toLowerCase() === sender)?.customer_id ??
    null;
  if (!customerId) return ignored("sender is not a known customer");

  // The webhook has metadata only; the body comes from the Receiving API.
  if (!env.resendApiKey) return NextResponse.json({ error: "RESEND_API_KEY missing" }, { status: 503 });
  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(d.email_id)}`, {
    headers: { Authorization: `Bearer ${env.resendApiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) {
    if (svix.id) seen.delete(svix.id); // let Resend retry
    return NextResponse.json({ error: "could not fetch email body" }, { status: 502 });
  }
  const received = receivedSchema.safeParse(await res.json().catch(() => null));
  const fullText = received.success ? received.data.text || (received.data.html ? htmlToText(decodeDataUri(received.data.html)) : "") : "";
  const text = extractReplyText(fullText).slice(0, 5000);
  if (!text) return ignored("empty reply");

  const subject = d.subject ?? (received.success ? received.data.subject : null) ?? "";
  const invoices = await ctx.store.list("invoices", { where: { customer_id: customerId } });
  const number = findInvoiceNumber(subject, text, invoices.map((i) => i.invoice_number));
  const invoiceId = number ? (invoices.find((i) => i.invoice_number === number)?.id ?? null) : null;

  const result = await processInboundReply(ctx, { customerId, invoiceId, channel: "EMAIL", body: text, source: "webhook" });
  await ctx.store.update("communications", result.communication.id, { subject: subject.slice(0, 300) || null, provider_message_id: d.email_id });
  return NextResponse.json({ ok: true, communication_id: result.communication.id, intent: result.classification.intent, escalated: result.escalated });
}
