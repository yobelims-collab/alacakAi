import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { CreateOrganizationForm } from "@/components/auth/create-organization-form";
import { getSessionUser } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Onboarding" };

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.organization_id) redirect("/inbox");
  const { t, locale } = await getT();
  return (
    <AuthShell t={t} locale={locale} demo={isDemoMode()}>
      <CreateOrganizationForm t={t} locale={locale} />
    </AuthShell>
  );
}
