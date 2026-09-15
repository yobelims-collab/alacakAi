/**
 * Central place to read environment configuration. Server-only values are never
 * re-exported to the client; `NEXT_PUBLIC_*` values are the only ones the browser sees.
 */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  cronSecret: process.env.CRON_SECRET ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  forceDemo: process.env.DEMO_MODE === "true",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  whatsappToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  whatsappPhoneId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
};

/** Supabase is "configured" only when both public values exist. */
export function hasSupabase(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey) && !env.forceDemo;
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
