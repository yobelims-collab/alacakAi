import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Reset password" };

export default async function ForgotPasswordPage() {
  const { locale } = await getT();
  return <ForgotPasswordForm locale={locale} />;
}
