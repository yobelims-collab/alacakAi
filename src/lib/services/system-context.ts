import "server-only";
import type { AppContext } from "@/lib/db";
import { getMemoryDatabase, MemoryStore } from "@/lib/db/memory-store";
import { SupabaseStore } from "@/lib/db/supabase-store";
import { isDemoMode } from "@/lib/env";
import { getDictionary } from "@/lib/i18n";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureDemoOrganization } from "@/lib/db/demo-seed";

/**
 * Builds an AppContext for background jobs (cron, webhooks) where there is no signed-in user.
 * Uses the service-role client in Supabase mode — callers MUST have verified a secret first.
 */
export async function systemContextFor(organizationId: string): Promise<AppContext | null> {
  if (isDemoMode()) {
    await ensureDemoOrganization();
    const db = getMemoryDatabase();
    if (!db.organizations.has(organizationId)) return null;
    const store = new MemoryStore(organizationId, db);
    const org = await store.getOrganization();
    return { user: systemUser(organizationId), store, org, locale: org.language, t: getDictionary(org.language), demo: true };
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const store = new SupabaseStore(organizationId, admin);
  const org = await store.getOrganization().catch(() => null);
  if (!org) return null;
  return { user: systemUser(organizationId), store, org, locale: org.language, t: getDictionary(org.language), demo: false };
}

/** Lists every organization id (for the cron sweep). */
export async function listOrganizationIds(): Promise<string[]> {
  if (isDemoMode()) {
    await ensureDemoOrganization();
    return [...getMemoryDatabase().organizations.keys()];
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data } = await admin.from("organizations").select("id");
  return (data ?? []).map((r) => r.id as string);
}

function systemUser(organizationId: string): AppContext["user"] {
  return { id: "00000000-0000-4000-8000-0000000000aa", email: "system@alacakai", full_name: "AlacakAI", organization_id: organizationId, role: "ADMIN", provider: "demo" };
}
