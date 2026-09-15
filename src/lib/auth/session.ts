import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { isDemoMode } from "@/lib/env";
import { getMemoryDatabase } from "@/lib/db/memory-store";
import { ensureDemoOrganization } from "@/lib/db/demo-seed";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile, SessionUser } from "@/lib/types";
import { DEMO_SESSION_COOKIE, verifyDemoSession } from "./demo-session";

/**
 * Resolves the signed-in user for this request (memoised per request).
 * Demo mode: signed cookie → in-memory user. Supabase mode: auth cookie → `profiles` row.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (isDemoMode()) {
    await ensureDemoOrganization();
    const token = (await cookies()).get(DEMO_SESSION_COOKIE)?.value;
    const uid = verifyDemoSession(token);
    if (!uid) return null;
    const db = getMemoryDatabase();
    const user = [...db.users.values()].find((u) => u.id === uid);
    if (!user) return null;
    const profile = (db.tables.profiles as Profile[]).find((p) => p.id === uid);
    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      organization_id: profile?.organization_id ?? null,
      role: profile?.role ?? "OWNER",
      provider: "demo",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();
  return {
    id: user.id,
    email: user.email ?? "",
    full_name: (profile?.full_name as string | undefined) ?? (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "",
    organization_id: (profile?.organization_id as string | undefined) ?? null,
    role: (profile?.role as SessionUser["role"] | undefined) ?? "OWNER",
    provider: "supabase",
  };
});
