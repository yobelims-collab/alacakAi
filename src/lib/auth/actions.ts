"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMemoryDatabase } from "@/lib/db/memory-store";
import { MemoryStore } from "@/lib/db/memory-store";
import { DEMO_EMAIL, DEMO_PASSWORD, demoOrganizationDefaults, ensureDemoOrganization, seedDemoData } from "@/lib/db/demo-seed";
import { newId } from "@/lib/db/store";
import { isDemoMode } from "@/lib/env";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOrganizationSchema, signInSchema, signUpSchema } from "@/lib/validation";
import { DEMO_SESSION_COOKIE, signDemoSession } from "./demo-session";
import { getSessionUser } from "./session";
import { storeForOrganization } from "@/lib/db";

export interface ActionState {
  error?: string;
  message?: string;
}

const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 };

export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { ...COOKIE_OPTS, httpOnly: false, maxAge: 60 * 60 * 24 * 365 });
}

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  const { email, password, full_name } = parsed.data;

  if (isDemoMode()) {
    await ensureDemoOrganization();
    const db = getMemoryDatabase();
    const key = email.toLowerCase();
    if (db.users.has(key)) return { error: "Bu e-posta zaten kayıtlı / email already registered" };
    const id = newId();
    db.users.set(key, { id, email: key, password, full_name });
    (await cookies()).set(DEMO_SESSION_COOKIE, signDemoSession(id), COOKIE_OPTS);
    redirect("/onboarding");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name, kvkk_ack_at: new Date().toISOString() } } });
  if (error) return { error: error.message };
  if (!data.session) return { message: "check_email" };
  redirect("/onboarding");
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "E-posta veya şifre geçersiz / invalid email or password" };
  const { email, password } = parsed.data;

  if (isDemoMode()) {
    await ensureDemoOrganization();
    const user = getMemoryDatabase().users.get(email.toLowerCase());
    if (!user || user.password !== password) return { error: "E-posta veya şifre hatalı / wrong email or password" };
    (await cookies()).set(DEMO_SESSION_COOKIE, signDemoSession(user.id), COOKIE_OPTS);
    redirect("/inbox");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/inbox");
}

/** One-click entry into the seeded demo company (demo mode only). */
export async function demoLoginAction(): Promise<void> {
  if (!isDemoMode()) redirect("/login");
  await ensureDemoOrganization();
  const user = getMemoryDatabase().users.get(DEMO_EMAIL);
  if (!user || user.password !== DEMO_PASSWORD) redirect("/login");
  (await cookies()).set(DEMO_SESSION_COOKIE, signDemoSession(user.id), COOKIE_OPTS);
  redirect("/inbox");
}

export async function signOutAction(): Promise<void> {
  if (isDemoMode()) {
    (await cookies()).delete(DEMO_SESSION_COOKIE);
  } else {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

export async function createOrganizationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.organization_id) redirect("/inbox");
  const parsed = createOrganizationSchema.safeParse({
    name: formData.get("name"),
    default_currency: formData.get("default_currency") ?? "TRY",
    default_payment_terms_days: formData.get("default_payment_terms_days") ?? 30,
    language: formData.get("language") ?? "tr",
    load_demo_data: formData.get("load_demo_data") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  const input = parsed.data;

  let orgId: string;
  if (isDemoMode()) {
    const db = getMemoryDatabase();
    orgId = newId();
    db.organizations.set(orgId, { id: orgId, created_at: new Date().toISOString(), ...demoOrganizationDefaults(input.name, { default_currency: input.default_currency, reporting_currency: input.default_currency, default_payment_terms_days: input.default_payment_terms_days, language: input.language }) });
    const store = new MemoryStore(orgId, db);
    await store.insert("profiles", { id: user.id, email: user.email, full_name: user.full_name, role: "OWNER" });
  } else {
    const supabase = await createSupabaseServerClient();
    // `create_organization` is a SECURITY DEFINER function in supabase/schema.sql that inserts the
    // organization and the caller's profile atomically (the only way a user can obtain an org).
    const { data, error } = await supabase.rpc("create_organization", {
      p_name: input.name,
      p_default_currency: input.default_currency,
      p_payment_terms: input.default_payment_terms_days,
      p_language: input.language,
      p_full_name: user.full_name,
    });
    if (error) return { error: error.message };
    orgId = data as string;
  }

  if (input.load_demo_data) {
    const store = await storeForOrganization(orgId);
    await seedDemoData(store, { ownerUserId: user.id });
  }
  redirect("/inbox");
}
