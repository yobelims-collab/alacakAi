"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { signUpAction, type ActionState } from "@/lib/auth/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/types";

const COPY = {
  tr: { title: "Ücretsiz hesap oluşturun", subtitle: "Kredi kartı gerekmez. Şirketinizi bir sonraki adımda tanımlayacaksınız.", passwordHint: "En az 8 karakter", kvkkPre: "", kvkkLink: "KVKK Aydınlatma Metni", kvkkPost: "'ni okudum ve anladım." },
  en: { title: "Create your free account", subtitle: "No credit card required. You will set up your company in the next step.", passwordHint: "At least 8 characters", kvkkPre: "I have read and understood the ", kvkkLink: "privacy and KVKK notice", kvkkPost: "." },
};

export function SignupForm({ t, locale }: { t: Dictionary; locale: Locale }) {
  const [state, formAction] = useActionState<ActionState, FormData>(signUpAction, {});
  const c = COPY[locale];

  if (state.message === "check_email") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <MailCheck className="size-6 text-emerald-600" />
          <p className="text-sm font-medium">{t.auth.checkEmail}</p>
          <Link href="/login" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
            {t.auth.signIn}
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{c.title}</CardTitle>
        <CardDescription>{c.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <Field label={t.auth.fullName}>
            <Input name="full_name" autoComplete="name" required minLength={2} maxLength={120} />
          </Field>
          <Field label={t.auth.email}>
            <Input name="email" type="email" autoComplete="email" required placeholder="ad@sirket.com" />
          </Field>
          <Field label={t.auth.password} hint={c.passwordHint}>
            <Input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
          </Field>
          <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <input type="checkbox" name="kvkk_ack" required className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
            <span>
              {c.kvkkPre}
              <Link href="/gizlilik" target="_blank" className="font-medium text-foreground underline underline-offset-4">{c.kvkkLink}</Link>
              {c.kvkkPost}
            </span>
          </label>
          {state.error && <p className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-800 dark:text-red-200">{state.error}</p>}
          <SubmitButton variant="brand" className="w-full">
            {t.auth.signUp}
          </SubmitButton>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t.auth.haveAccount}{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            {t.auth.signIn}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
