import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Pure helpers for inbound customer emails (Resend "email.received" webhooks).
 * Routing: outbound reminders set Reply-To `reply+<organizationId>@<INBOUND_EMAIL_DOMAIN>`, so a
 * customer's reply carries the organization in its recipient address.
 */

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function replyToAddress(organizationId: string, domain: string): string {
  return `reply+${organizationId}@${domain}`;
}

/** Finds the organization id in any `reply+<uuid>@<domain>` recipient. */
export function organizationFromRecipients(recipients: string[], domain: string): string | null {
  const d = domain.trim().toLowerCase();
  for (const r of recipients) {
    const addr = parseAddress(r).email;
    const [local, host] = addr.split("@");
    if (!local || !host || (d && host !== d)) continue;
    const m = local.match(/^reply\+(.+)$/i);
    const id = m?.[1].match(UUID)?.[0];
    if (id) return id.toLowerCase();
  }
  return null;
}

/** "Ahmet Yılmaz <ahmet@abc.com>" → { name, email } (email lowercased). */
export function parseAddress(raw: string): { name: string | null; email: string } {
  const s = (raw ?? "").trim();
  const m = s.match(/^(.*)<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim().replace(/^"|"$/g, "") || null, email: m[2].trim().toLowerCase() };
  return { name: null, email: s.toLowerCase() };
}

/** Resend may return HTML as a data URI; decode it to plain HTML. */
export function decodeDataUri(value: string): string {
  const m = value.match(/^data:([^,]*?)(;base64)?,([\s\S]*)$/);
  if (!m) return value;
  return m[2] ? Buffer.from(m[3], "base64").toString("utf8") : decodeURIComponent(m[3]);
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Quoted-history markers in Turkish and English mail clients. */
const QUOTE_MARKERS: RegExp[] = [
  /^on .+wrote:\s*$/i,
  /^.+ tarihinde .+ (şunu )?yazdı:\s*$/i,
  /^-{2,}\s*(original message|orijinal mesaj|forwarded message|iletilen mesaj)\s*-{2,}/i,
  /^(from|kimden|gönderen)\s*:/i,
  /^_{5,}\s*$/,
];

/** Keeps only the customer's new text: drops quoted history ("> …", "On … wrote:") and signatures ("-- "). */
export function extractReplyText(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (QUOTE_MARKERS.some((r) => r.test(t))) break;
    if (t === "--" || t === "-- ") break;
    if (t.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** First known invoice number mentioned in the subject or body (case-insensitive). */
export function findInvoiceNumber(subject: string, body: string, known: string[]): string | null {
  // Invoice numbers are codes, not words: fold case without the Turkish locale (which maps I→ı)
  // and treat ı/İ as i so "INV", "inv" and "ınv" all match.
  const fold = (s: string) => s.replace(/[ıİ]/g, "i").toLowerCase();
  const hay = fold(`${subject}\n${body}`);
  const sorted = [...known].sort((a, b) => b.length - a.length);
  return sorted.find((n) => n && hay.includes(fold(n))) ?? null;
}

/**
 * Verifies a Svix-signed webhook (Resend signs webhooks with Svix):
 * HMAC-SHA256 over `${id}.${timestamp}.${body}` with the base64 key after "whsec_",
 * compared against any "v1,<base64>" entry of the svix-signature header; 5-minute tolerance.
 */
export function verifySvixSignature(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > 300) return false;
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${headers.id}.${headers.timestamp}.${body}`).digest();
  for (const part of headers.signature.split(" ")) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    const given = Buffer.from(sig, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) return true;
  }
  return false;
}
