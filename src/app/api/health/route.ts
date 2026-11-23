import { NextResponse } from "next/server";
import { hasEmailProvider, hasOpenAI, hasSupabase, hasWhatsAppProvider, isDemoMode, supabaseConfigProblem, supabaseUrlNote } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Non-sensitive readiness info: which integrations are configured (never the values). */
export function GET() {
  return NextResponse.json({
    ok: true,
    demo_mode: isDemoMode(),
    supabase: hasSupabase(),
    supabase_problem: supabaseConfigProblem(),
    supabase_url_note: supabaseUrlNote(),
    service_role_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    cron_secret: Boolean(process.env.CRON_SECRET),
    email_import: Boolean(process.env.INBOUND_EMAIL_DOMAIN && process.env.RESEND_WEBHOOK_SECRET && process.env.RESEND_API_KEY && (process.env.INBOUND_IMPORT_SECRET || process.env.SESSION_SECRET)),
    openai: hasOpenAI(),
    email_provider: hasEmailProvider(),
    whatsapp_provider: hasWhatsAppProvider(),
  });
}
