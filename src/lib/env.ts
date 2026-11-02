/**
 * Central place to read environment configuration. Server-only values are never
 * re-exported to the client; `NEXT_PUBLIC_*` values are the only ones the browser sees.
 */
export const env = {
  supabaseUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, ""),
  supabaseAnonKey: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  cronSecret: process.env.CRON_SECRET ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  forceDemo: process.env.DEMO_MODE === "true",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  /** Svix signing secret (whsec_…) of the Resend "email.received" webhook. */
  resendWebhookSecret: (process.env.RESEND_WEBHOOK_SECRET ?? "").trim(),
  /** Receiving domain for customer replies, e.g. reply.alacore.app (reply+<orgId>@domain). */
  inboundEmailDomain: (process.env.INBOUND_EMAIL_DOMAIN ?? "").trim().toLowerCase(),
  whatsappToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  whatsappPhoneId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
};

/** Supabase is "configured" only when both public values exist. */
/** Why Supabase is not used (null when it is). Shown by /api/health so a bad variable is easy to spot. */
export function supabaseConfigProblem(): string | null {
  if (env.forceDemo) return "DEMO_MODE=true";
  if (!env.supabaseUrl && !env.supabaseAnonKey) return "not configured";
  if (!env.supabaseUrl) return "NEXT_PUBLIC_SUPABASE_URL is missing";
  if (!env.supabaseAnonKey) return "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing";
  try {
    const u = new URL(env.supabaseUrl);
    if (u.protocol !== "https:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return "NEXT_PUBLIC_SUPABASE_URL must start with https://";
  } catch {
    return "NEXT_PUBLIC_SUPABASE_URL is not a valid URL";
  }
  if (env.supabaseAnonKey.length < 20) return "NEXT_PUBLIC_SUPABASE_ANON_KEY looks too short";
  return null;
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
