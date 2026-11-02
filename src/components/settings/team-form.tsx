"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Mail, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { inviteMemberAction, type InviteState } from "@/lib/actions/team";
import { INVITABLE_ROLES } from "@/lib/domain/roles";
import type { Locale } from "@/lib/types";
import { ROLE_COPY } from "./team-copy";

const COPY = {
  tr: {
    title: "Ekip arkadaşı davet et",
    hint: "Finans ve satış ekibinden kişileri ekleyin. Satış rolündekiler, hesap yöneticisi oldukları müşterilerle ilgili kartları görür.",
    hintDemo: "Demo modunda e-posta gönderilmez: davetten sonra geçici şifre bir kez burada gösterilir.",
    email: "E-posta",
    fullName: "Ad Soyad",
    role: "Rol",
    send: "Davet et",
    roles: "Roller",
    sentEmail: (e: string) => `${e} adresine davet e-postası gönderildi.`,
    demoTitle: "Kullanıcı oluşturuldu (demo)",
    demoBody: "Demo modunda e-posta gönderilmez. Bu bilgileri ekip arkadaşınıza kendiniz iletin; şifre yalnızca şimdi gösteriliyor.",
    loginUrl: "Giriş adresi",
    password: "Geçici şifre",
    copy: "Kopyala",
    copied: "Kopyalandı",
    dismiss: "Kapat",
  },
  en: {
    title: "Invite a colleague",
    hint: "Add people from finance and sales. Sales members see the cards about customers they are account manager of.",
    hintDemo: "Demo mode sends no email: after inviting, a temporary password is shown here once.",
    email: "Email",
    fullName: "Full name",
    role: "Role",
    send: "Invite",
    roles: "Roles",
    sentEmail: (e: string) => `Invitation email sent to ${e}.`,
    demoTitle: "User created (demo)",
    demoBody: "Demo mode sends no email. Share these details with your colleague yourself; the password is shown only now.",
    loginUrl: "Login URL",
    password: "Temporary password",
    copy: "Copy",
    copied: "Copied",
    dismiss: "Dismiss",
  },
};

export function TeamForm({ locale, demo, loginUrl }: { locale: Locale; demo: boolean; loginUrl: string }) {
  const [state, formAction] = useActionState<InviteState, FormData>(inviteMemberAction, {});
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const c = COPY[locale];
  const roles = ROLE_COPY[locale];
  const invited = state.invited;

  useEffect(() => {
    if (invited?.mode === "email") toast.success(c.sentEmail(invited.email));
  }, [invited, c]);

  const showDemoNotice = invited?.mode === "demo" && invited.tempPassword && dismissedAt !== invited.at;

  async function copyCredentials() {
    if (!invited?.tempPassword) return;
    const text = `${c.loginUrl}: ${loginUrl}\n${c.email}: ${invited.email}\n${c.password}: ${invited.tempPassword}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Clipboard unavailable");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="size-4 text-muted-foreground" /> {c.title}
        </CardTitle>
        <CardDescription>{c.hint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {showDemoNotice && (
          <div role="status" className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-900 dark:text-amber-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 font-medium">
                <KeyRound className="size-4" /> {c.demoTitle}
              </div>
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={c.dismiss} onClick={() => setDismissedAt(invited.at)}>
                <X />
              </Button>
            </div>
            <p className="mt-1 text-xs">{c.demoBody}</p>
            <dl className="mt-3 grid gap-1 text-xs sm:grid-cols-[140px_1fr]">
              <dt className="text-amber-800 dark:text-amber-200">{c.loginUrl}</dt>
              <dd className="font-mono break-all">{loginUrl}</dd>
              <dt className="text-amber-800 dark:text-amber-200">{c.email}</dt>
              <dd className="font-mono break-all">{invited.email}</dd>
              <dt className="text-amber-800 dark:text-amber-200">{c.password}</dt>
              <dd className="font-mono">{invited.tempPassword}</dd>
            </dl>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={copyCredentials}>
              {copied ? <Check /> : <Copy />} {copied ? c.copied : c.copy}
            </Button>
          </div>
        )}

        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <Field label={c.email}>
            <Input type="email" name="email" placeholder="ad@sirket.com" required maxLength={254} />
          </Field>
          <Field label={c.fullName}>
            <Input name="full_name" required minLength={2} maxLength={120} />
          </Field>
          <Field label={c.role}>
            <Select name="role" defaultValue="FINANCE">
              {INVITABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roles[r].label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <SubmitButton variant="brand" size="sm">
              <Mail /> {c.send}
            </SubmitButton>
          </div>

          {state.error && (
            <p role="alert" className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-800 dark:text-red-200 sm:col-span-2">
              {state.error}
            </p>
          )}
        </form>

        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.roles}</p>
          <ul className="mt-1.5 space-y-1 text-xs">
            {INVITABLE_ROLES.map((r) => (
              <li key={r}>
                <span className="font-medium">{roles[r].label}</span> <span className="text-muted-foreground">— {roles[r].hint}</span>
              </li>
            ))}
          </ul>
        </div>
        {demo && <p className="text-xs text-muted-foreground">{c.hintDemo}</p>}
      </CardContent>
    </Card>
  );
}
