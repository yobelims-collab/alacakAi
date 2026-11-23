import { cleanKey, normalizeSupabaseUrl } from "./supabase-url";
/**
 * Central place to read environment configuration. Server-only values are never
 * re-exported to the client; `NEXT_PUBLIC_*` values are the only ones the browser sees.
 */
function appBaseUrl(): string {
  const explicit = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");
  if (explicit) return /^https?:\/\//.test(explicit) ? explicit : `https://${explicit}`;
  const vercel = (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL ?? "").trim();
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

export const env = {
  supabaseUrl: normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL).url,
  supabaseAnonKey: cleanKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  supabaseServiceRoleKey: cleanKey(process.env.SUPABASE_SERVICE_ROLE_KEY),
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  cronSecret: process.env.CRON_SECRET ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  /** Public base URL for links in emails: NEXT_PUBLIC_APP_URL, else Vercel's production domain, else localhost. */
  appUrl: appBaseUrl(),
  forceDemo: process.env.DEMO_MODE === "true",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  /** Svix signing secret (whsec_…) of the Resend "email.received" webhook. */
  resendWebhookSecret: (process.env.RESEND_WEBHOOK_SECRET ?? "").trim(),
  /** Receiving domain for customer replies, e.g. reply.alacore.app (reply+<orgId>@domain). */
  inboundEmailDomain: (process.env.INBOUND_EMAIL_DOMAIN ?? "").trim().toLowerCase(),
  /** Secret for the per-company ERP import address (falls back to SESSION_SECRET; empty disables it). */
  importSecret: (process.env.INBOUND_IMPORT_SECRET ?? process.env.SESSION_SECRET ?? "").trim(),
  whatsappToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  whatsappPhoneId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
};

/** Plain-language note about how NEXT_PUBLIC_SUPABASE_URL was read (null when it was used as is). */
export function supabaseUrlNote(): string | null {
  return normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL).note;
}

/** Why Supabase is not used (null when it is). Shown by /api/health so a bad variable is easy to spot. */
export function supabaseConfigProblem(): string | null {
  if (env.forceDemo) return "DEMO_MODE=true";
  const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  if (!rawUrl && !env.supabaseAnonKey) return "not configured";
  if (!rawUrl) return "NEXT_PUBLIC_SUPABASE_URL is missing";
  const url = normalizeSupabaseUrl(rawUrl);
  if (!url.valid) return url.note ?? "NEXT_PUBLIC_SUPABASE_URL is not a valid URL";
  if (!env.supabaseAnonKey) return "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing";
  if (env.supabaseAnonKey.length < 20) return "NEXT_PUBLIC_SUPABASE_ANON_KEY looks too short";
  if (isSecretKey(env.supabaseAnonKey)) return "NEXT_PUBLIC_SUPABASE_ANON_KEY holds the secret (service_role) key, which must never be public. Use the anon / publishable key and rotate the secret key in Supabase.";
  return null;
}

/** True for a service_role JWT or an sb_secret_ key (these must never be in a NEXT_PUBLIC_ variable). */
function isSecretKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  const parts = key.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as { role?: string };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

/** Supabase is used only when both public values exist and look valid; otherwise the app stays in demo mode. */
export function hasSupabase(): boolean {
  return supabaseConfigProblem() === null;
}

/** Demo mode = no Supabase (or DEMO_MODE=true): in-memory data, demo auth. */
export function isDemoMode(): boolean {
  return !hasSupabase();
}

export function hasOpenAI(): boolean {
  return Boolean(env.openaiApiKey);
}

export function hasEmailProvider(): boolean {
  return Boolean(env.resendApiKey);
}

export function hasWhatsAppProvider(): boolean {
  return Boolean(env.whatsappToken && env.whatsappPhoneId);
}
