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
  tr: { title: "Hesabınıza giriş yapın", subtitle: "Alacaklarınızı takip etmeye devam edin.", credentials: "Demo bilgileri" },
  en: { title: "Sign in to your account", subtitle: "Pick up where you left off with your receivables.", credentials: "Demo credentials" },
};

export function LoginForm({ t, locale, demo, highlightDemo }: { t: Dictionary; locale: Locale; demo: boolean; highlightDemo: boolean }) {
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
        <form action={formAction} className="flex flex-col gap-4">
          <Field label={t.auth.email}>
            <Input name="email" type="email" autoComplete="email" required placeholder="ad@sirket.com" />
          </Field>
          <Field label={t.auth.password}>
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
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
