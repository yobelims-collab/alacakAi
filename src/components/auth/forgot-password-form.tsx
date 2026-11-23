"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestPasswordResetAction, type ActionState } from "@/lib/auth/actions";
import type { Locale } from "@/lib/types";

const COPY = {
  tr: {
    title: "Şifrenizi mi unuttunuz?",
    subtitle: "Hesabınızın e-posta adresini yazın; şifre sıfırlama bağlantısı gönderelim.",
    email: "E-posta",
    send: "Bağlantı gönder",
    sent: "Bu adrese kayıtlı bir hesap varsa, birkaç dakika içinde şifre sıfırlama bağlantısı gelecek. Spam klasörünü de kontrol edin.",
    demo: "Demo modunda e-posta gönderilmez. Demo hesabıyla giriş yapın: demo@alacore.app / demo1234",
    back: "Girişe dön",
  },
  en: {
    title: "Forgot your password?",
    subtitle: "Enter your account’s email address and we’ll send you a reset link.",
    email: "Email",
    send: "Send link",
    sent: "If an account exists for this address, a reset link will arrive within a few minutes. Check your spam folder too.",
    demo: "Demo mode sends no emails. Sign in with the demo account: demo@alacore.app / demo1234",
    back: "Back to sign in",
  },
};

export function ForgotPasswordForm({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  const [state, formAction] = useActionState<ActionState, FormData>(requestPasswordResetAction, {});
  const done = state.message === "sent" || state.message === "demo";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{c.title}</CardTitle>
        <CardDescription>{c.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        {done ? (
          <p className="flex items-start gap-2 text-sm">
            <MailCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> {state.message === "demo" ? c.demo : c.sent}
          </p>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <Field label={c.email}>
              <Input name="email" type="email" autoComplete="email" required placeholder="ad@sirket.com" />
            </Field>
            {state.error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{state.error}</p>}
            <SubmitButton variant="brand" className="w-full">
              {c.send}
            </SubmitButton>
          </form>
        )}
        <p className="mt-4 text-center text-xs">
          <Link href="/login" className="text-muted-foreground underline-offset-4 hover:underline">{c.back}</Link>
        </p>
      </CardContent>
    </Card>
  );
}
