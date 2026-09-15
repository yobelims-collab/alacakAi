import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { getSessionUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Sign up" };

export default async function SignupPage() {
  const user = await getSessionUser();
  if (user) redirect(user.organization_id ? "/dashboard" : "/onboarding");
  const { t, locale } = await getT();
  return <SignupForm t={t} locale={locale} />;
}
