"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/types";

const COPY = {
  tr: {
    title: "Şifrenizi belirleyin",
    subtitle: "Davetinizi kabul etmek için hesabınıza bir şifre belirleyin.",
    password: "Yeni şifre",
    confirm: "Şifre (tekrar)",
    hint: "En az 8 karakter",
    save: "Şifreyi kaydet ve devam et",
    checking: "Davet bağlantısı doğrulanıyor…",
    invalid: "Bağlantı geçersiz veya süresi dolmuş. Yöneticinizden yeni bir davet isteyin.",
    mismatch: "Şifreler eşleşmiyor.",
    short: "Şifre en az 8 karakter olmalı.",
    demo: "Demo modunda davet e-postası gönderilmez; size verilen geçici şifreyle giriş yapın.",
    login: "Girişe dön",
  },
  en: {
    title: "Set your password",
    subtitle: "Choose a password for your account to accept the invitation.",
    password: "New password",
    confirm: "Repeat password",
    hint: "At least 8 characters",
    save: "Save password and continue",
    checking: "Checking your invitation link…",
    invalid: "This link is invalid or expired. Ask your admin for a new invitation.",
    mismatch: "Passwords do not match.",
    short: "Password must be at least 8 characters.",
    demo: "Demo mode sends no invitation emails; sign in with the temporary password you were given.",
    login: "Back to sign in",
  },
};

type Phase = "checking" | "ready" | "invalid";

export function SetPasswordForm({ locale, supabaseUrl, supabaseAnonKey }: { locale: Locale; supabaseUrl: string; supabaseAnonKey: string }) {
  const c = COPY[locale];
  const router = useRouter();
  const supabase = useMemo(() => (supabaseUrl ? createBrowserClient(supabaseUrl, supabaseAnonKey) : null), [supabaseUrl, supabaseAnonKey]);
  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      // Invite links from the admin API return tokens in the hash; PKCE links return ?code=.
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const code = new URLSearchParams(window.location.search).get("code");
      let ok = false;
      if (hash.get("access_token") && hash.get("refresh_token")) {
        const { error: e } = await supabase.auth.setSession({ access_token: hash.get("access_token")!, refresh_token: hash.get("refresh_token")! });
        ok = !e;
      } else if (code) {
        const { error: e } = await supabase.auth.exchangeCodeForSession(code);
        ok = !e;
      } else {
        ok = !!(await supabase.auth.getSession()).data.session;
      }
      if (ok) window.history.replaceState(null, "", window.location.pathname);
      if (!cancelled) setPhase(ok ? "ready" : "invalid");
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    if (password.length < 8) return setError(c.short);
    if (password !== String(fd.get("confirm") ?? "")) return setError(c.mismatch);
    setBusy(true);
    const { error: e2 } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (e2) return setError(e2.message);
    router.replace("/inbox");
    router.refresh();
  }

  const body = !supabase ? (
    <p className="text-sm text-muted-foreground">{c.demo}</p>
  ) : phase === "checking" ? (
    <p className="text-sm text-muted-foreground">{c.checking}</p>
  ) : phase === "invalid" ? (
    <p className="text-sm text-red-700 dark:text-red-300">{c.invalid}</p>
  ) : (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label={c.password} hint={c.hint}>
        <Input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
      </Field>
      <Field label={c.confirm}>
        <Input name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
      </Field>
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
      <Button type="submit" variant="brand" className="w-full" disabled={busy}>{c.save}</Button>
    </form>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{c.title}</CardTitle>
        <CardDescription>{c.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        {body}
        {phase !== "ready" && (
          <p className="mt-4 text-center text-xs">
            <Link href="/login" className="text-muted-foreground underline-offset-4 hover:underline">{c.login}</Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
