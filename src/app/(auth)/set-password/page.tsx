import { SetPasswordForm } from "@/components/auth/set-password-form";
import { env, hasSupabase } from "@/lib/env";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Set password" };

/** Landing page of Supabase invite (and password-recovery) emails: the link carries a session in the URL hash. */
export default async function SetPasswordPage() {
  const { locale } = await getT();
  return <SetPasswordForm locale={locale} supabaseUrl={hasSupabase() ? env.supabaseUrl : ""} supabaseAnonKey={hasSupabase() ? env.supabaseAnonKey : ""} />;
}
