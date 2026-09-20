import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ demo?: string | string[] }> }) {
  const user = await getSessionUser();
  if (user) redirect(user.organization_id ? "/inbox" : "/onboarding");
  const { demo } = await searchParams;
  const { t, locale } = await getT();
  return <LoginForm t={t} locale={locale} demo={isDemoMode()} highlightDemo={demo === "1"} />;
}
