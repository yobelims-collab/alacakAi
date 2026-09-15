import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";
import { getT } from "@/lib/i18n";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Locale, Organization, SessionUser } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { MemoryStore } from "./memory-store";
import type { DataStore } from "./store";
import { SupabaseStore } from "./supabase-store";

export async function storeForOrganization(organizationId: string): Promise<DataStore> {
  if (isDemoMode()) return new MemoryStore(organizationId);
  const client = await createSupabaseServerClient();
  return new SupabaseStore(organizationId, client);
}

export interface AppContext {
  user: SessionUser & { organization_id: string };
  store: DataStore;
  org: Organization;
  locale: Locale;
  t: Dictionary;
  demo: boolean;
}

/**
 * The single entry point for authenticated server code (pages, server actions, route handlers).
 * Redirects to sign-in when there is no session and to onboarding when the user has no company.
 */
export const requireContext = cache(async (): Promise<AppContext> => {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.organization_id) redirect("/onboarding");
  const store = await storeForOrganization(user.organization_id);
  const org = await store.getOrganization();
  const { locale, t } = await getT();
  return { user: { ...user, organization_id: user.organization_id }, store, org, locale, t, demo: isDemoMode() };
});
