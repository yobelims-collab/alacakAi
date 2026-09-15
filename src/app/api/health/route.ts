import { NextResponse } from "next/server";
import { hasEmailProvider, hasOpenAI, hasSupabase, hasWhatsAppProvider, isDemoMode } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Non-sensitive readiness info: which integrations are configured (never the values). */
export function GET() {
  return NextResponse.json({
    ok: true,
    demo_mode: isDemoMode(),
    supabase: hasSupabase(),
    openai: hasOpenAI(),
    email_provider: hasEmailProvider(),
    whatsapp_provider: hasWhatsAppProvider(),
  });
}
