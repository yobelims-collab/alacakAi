import "server-only";
import { env, hasEmailProvider, hasWhatsAppProvider } from "@/lib/env";
import type { Channel } from "@/lib/types";

export interface OutboundMessage {
  channel: Channel;
  to: string | null;
  subject: string | null;
  body: string;
  fromName: string | null;
  fromEmail: string | null;
}

export interface SendResult {
  /** "SENT" only when a real provider accepted the message; "SENT_SIMULATED" otherwise. */
  status: "SENT" | "SENT_SIMULATED" | "FAILED";
  providerMessageId: string | null;
  note: string | null;
}

/**
 * Messaging boundary. Real providers are used only when their credentials are configured;
 * otherwise the message is recorded as simulated. The application never claims a message
 * was delivered when no provider is connected.
 */
export async function sendMessage(msg: OutboundMessage): Promise<SendResult> {
  if (msg.channel === "EMAIL") {
    if (!hasEmailProvider()) return { status: "SENT_SIMULATED", providerMessageId: null, note: "email provider not configured" };
    if (!msg.to) return { status: "FAILED", providerMessageId: null, note: "customer has no email" };
    return sendViaResend(msg);
  }
  if (!hasWhatsAppProvider()) return { status: "SENT_SIMULATED", providerMessageId: null, note: "whatsapp provider not configured" };
  if (!msg.to) return { status: "FAILED", providerMessageId: null, note: "customer has no whatsapp number" };
  return sendViaWhatsAppCloud(msg);
}

async function sendViaResend(msg: OutboundMessage): Promise<SendResult> {
  try {
    const from = msg.fromEmail ? `${msg.fromName ?? "AlacakAI"} <${msg.fromEmail}>` : "AlacakAI <onboarding@resend.dev>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject ?? "", text: msg.body }),
    });
    if (!res.ok) return { status: "FAILED", providerMessageId: null, note: `resend ${res.status}` };
    const data = (await res.json()) as { id?: string };
    return { status: "SENT", providerMessageId: data.id ?? null, note: null };
  } catch (err) {
    return { status: "FAILED", providerMessageId: null, note: err instanceof Error ? err.message : "send failed" };
  }
}

async function sendViaWhatsAppCloud(msg: OutboundMessage): Promise<SendResult> {
  try {
    const to = (msg.to ?? "").replace(/[^\d]/g, "");
    const res = await fetch(`https://graph.facebook.com/v20.0/${env.whatsappPhoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.whatsappToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: msg.body } }),
    });
    if (!res.ok) return { status: "FAILED", providerMessageId: null, note: `whatsapp ${res.status}` };
    const data = (await res.json()) as { messages?: { id: string }[] };
    return { status: "SENT", providerMessageId: data.messages?.[0]?.id ?? null, note: null };
  } catch (err) {
    return { status: "FAILED", providerMessageId: null, note: err instanceof Error ? err.message : "send failed" };
  }
}
