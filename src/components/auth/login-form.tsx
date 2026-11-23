"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FlaskConical, LogIn } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { demoLoginAction, signInAction, type ActionState } from "@/lib/auth/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/types";

const COPY = {
  tr: { title: "Hesabınıza giriş yapın", subtitle: "Alacaklarınızı takip etmeye devam edin.", credentials: "Demo bilgileri", forgot: "Şifremi unuttum", link: "E-posta bağlantısı bu tarayıcıda oturum açamadı. E-postanız doğrulandıysa aşağıdan giriş yapabilirsiniz." },
  en: { title: "Sign in to your account", subtitle: "Pick up where you left off with your receivables.", credentials: "Demo credentials", forgot: "Forgot password?", link: "The email link could not sign you in on this browser. If your email is confirmed, sign in below." },
};

export function LoginForm({ t, locale, demo, highlightDemo, linkNotice = false }: { t: Dictionary; locale: Locale; demo: boolean; highlightDemo: boolean; linkNotice?: boolean }) {
  const [state, formAction] = useActionState<ActionState, FormData>(signInAction, {});
  const c = COPY[locale];

  const demoCard = demo ? (
    <Card className="border-primary/40 bg-accent/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4 text-muted-foreground" /> {t.auth.demoLogin}
        </CardTitle>
        <CardDescription>{t.auth.demoLoginHint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="rounded-md border bg-background px-3 py-2 font-mono text-xs">
          <p className="mb-1 font-sans text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.credentials}</p>
          <p>demo@alacore.app</p>
          <p>demo1234</p>
        </div>
        <form action={demoLoginAction}>
          <SubmitButton variant="brand" className="w-full">
            <LogIn /> {t.auth.demoLogin}
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  ) : null;

  const loginCard = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{c.title}</CardTitle>
        <CardDescription>{c.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        {linkNotice && <p className="mb-4 rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">{c.link}</p>}
        <form action={formAction} className="flex flex-col gap-4">
          <Field label={t.auth.email}>
            <Input name="email" type="email" autoComplete="email" required placeholder="ad@sirket.com" />
          </Field>
          <Field label={t.auth.password}>
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
          {!demo && (
            <Link href="/forgot-password" className="-mt-2 self-end text-xs text-muted-foreground underline-offset-4 hover:underline">
              {c.forgot}
            </Link>
          )}
          {state.error && <p className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-800 dark:text-red-200">{state.error}</p>}
          <SubmitButton variant={highlightDemo && demo ? "outline" : "brand"} className="w-full">
            {t.auth.signIn}
          </SubmitButton>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t.auth.noAccount}{" "}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            {t.auth.signUp}
          </Link>
        </p>
      </CardContent>
    </Card>
  );

  return highlightDemo ? (
    <>
      {demoCard}
      {loginCard}
    </>
  ) : (
    <>
      {loginCard}
      {demoCard}
    </>
  );
}
