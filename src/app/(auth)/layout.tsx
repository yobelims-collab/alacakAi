import { AuthShell } from "@/components/auth/auth-shell";
import { isDemoMode } from "@/lib/env";
import { getT } from "@/lib/i18n";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t, locale } = await getT();
  return (
    <AuthShell t={t} locale={locale} demo={isDemoMode()}>
      {children}
    </AuthShell>
  );
}
