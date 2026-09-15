import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { processInboundReply } from "@/lib/services/collection-service";
import { systemContextFor } from "@/lib/services/system-context";

export const dynamic = "force-dynamic";

/**
 * Provider-agnostic inbound webhook: POST /api/inbound/email or /api/inbound/whatsapp.
 * Adapters for a specific provider (Resend inbound, Meta WhatsApp Cloud API, Twilio…) should
 * translate their payload into this shape. Protected by INBOUND_WEBHOOK_SECRET.
 */
const payloadSchema = z.object({
  organization_id: z.string().uuid(),
  from: z.string().trim().min(3).max(200),
  text: z.string().trim().min(1).max(5000),
  invoice_number: z.string().trim().max(64).optional(),
});

function authorized(req: NextRequest): boolean {
  const secret = process.env.INBOUND_WEBHOOK_SECRET ?? "";
  if (!secret) return false;
  const given = req.headers.get("x-webhook-secret") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ channel: string }> }) {
  const { channel } = await params;
  if (channel !== "email" && channel !== "whatsapp") return NextResponse.json({ error: "unknown channel" }, { status: 404 });
  const rl = rateLimit(`inbound:${clientIp(req.headers)}`, 60, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "rate limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid payload", issues: parsed.error.issues }, { status: 400 });

  const ctx = await systemContextFor(parsed.data.organization_id);
  if (!ctx) return NextResponse.json({ error: "organization not found" }, { status: 404 });

  const customers = await ctx.store.list("customers");
  const from = parsed.data.from.toLowerCase();
  const digits = from.replace(/\D/g, "");
  const customer = customers.find((c) =>
    channel === "email" ? (c.email ?? "").toLowerCase() === from : digits.length >= 8 && (c.whatsapp_number ?? c.phone ?? "").replace(/\D/g, "").endsWith(digits.slice(-9)),
  );
  if (!customer) return NextResponse.json({ error: "customer not found for sender" }, { status: 404 });

  let invoiceId: string | null = null;
  if (parsed.data.invoice_number) {
    const inv = (await ctx.store.list("invoices", { where: { invoice_number: parsed.data.invoice_number, customer_id: customer.id } }))[0];
    invoiceId = inv?.id ?? null;
  }
  const result = await processInboundReply(ctx, { customerId: customer.id, invoiceId, channel: channel === "email" ? "EMAIL" : "WHATSAPP", body: parsed.data.text, source: "webhook" });
  return NextResponse.json({ ok: true, communication_id: result.communication.id, intent: result.classification.intent, confidence: result.classification.confidence, escalated: result.escalated, promise_id: result.promise?.id ?? null });
}
