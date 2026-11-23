import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Only same-site relative paths, so the link cannot send people to another site. */
function safeNext(raw: string | null, fallback: string): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : fallback;
}

/**
 * Landing URL for Supabase email links (signup confirmation, password reset, magic links).
 * PKCE links carry ?code=, custom templates may send ?token_hash=&type=. On success the session
 * cookies are set and the user continues to `next`; otherwise they go to /login with a hint.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"), "/onboarding");
  if (isDemoMode()) return NextResponse.redirect(new URL("/login", url.origin));

  const supabase = await createSupabaseServerClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;

  if (ok) return NextResponse.redirect(new URL(next, url.origin));
  // The email is usually confirmed even when the session cannot be created here (e.g. the link was
  // opened in another browser), so invite the user to sign in.
  return NextResponse.redirect(new URL("/login?link=1", url.origin));
}
