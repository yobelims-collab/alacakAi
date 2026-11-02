import { NextResponse } from "next/server";
import { hasEmailProvider, hasOpenAI, hasSupabase, hasWhatsAppProvider, isDemoMode, supabaseConfigProblem } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Non-sensitive readiness info: which integrations are configured (never the values). */
export function GET() {
  return NextResponse.json({
    ok: true,
    demo_mode: isDemoMode(),
    supabase: hasSupabase(),
    supabase_problem: supabaseConfigProblem(),
    service_role_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    cron_secret: Boolean(process.env.CRON_SECRET),
    openai: hasOpenAI(),
    email_provider: hasEmailProvider(),
    whatsapp_provider: hasWhatsAppProvider(),
  });
}
