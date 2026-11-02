import { NextResponse, type NextRequest } from "next/server";
import { hasSupabase } from "@/lib/env";
import { refreshSupabaseSession } from "@/lib/supabase/proxy-client";

const PROTECTED_PREFIXES = ["/inbox", "/dashboard", "/customers", "/invoices", "/payments", "/communications", "/ai-actions", "/attention", "/settings", "/onboarding"];
const DEMO_COOKIE = "alacakai_demo_session";

/**
 * Optimistic auth gate: unauthenticated requests to app routes are redirected to /login.
 * Real authorization happens in `requireContext()` on the server; this only saves a render.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (hasSupabase()) {
    try {
      const { response, signedIn } = await refreshSupabaseSession(request);
      if (isProtected && !signedIn) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname)}`, request.url));
      return response;
    } catch (err) {
      // Never take the whole site down because the auth service is unreachable or misconfigured;
      // requireContext() still enforces auth on every protected page.
      console.error("proxy: supabase session refresh failed", err);
      return NextResponse.next();
    }
  }

  if (isProtected && !request.cookies.get(DEMO_COOKIE)?.value) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname)}`, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
