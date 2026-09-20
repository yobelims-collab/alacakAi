"use client";

import { useActionState } from "react";
import { Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { createOrganizationAction, type ActionState } from "@/lib/auth/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { CURRENCIES, type Locale } from "@/lib/types";

const COPY = {
  tr: { language: "Şirket dili", languageHint: "Yeni müşterilerin varsayılan yazışma dili." },
  en: { language: "Company language", languageHint: "Default correspondence language for new customers." },
};

export function CreateOrganizationForm({ t, locale }: { t: Dictionary; locale: Locale }) {
  const [state, formAction] = useActionState<ActionState, FormData>(createOrganizationAction, {});
  const c = COPY[locale];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="size-4 text-muted-foreground" /> {t.auth.createCompany}
        </CardTitle>
        <CardDescription>{t.auth.createCompanyHint}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <Field label={t.settings.companyName}>
            <Input name="name" required minLength={2} maxLength={200} autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.settings.defaultCurrency}>
              <Select name="default_currency" defaultValue="TRY">
                {CURRENCIES.map((cur) => (
                  <option key={cur} value={cur}>{cur}</option>
                ))}
              </Select>
            </Field>
            <Field label={t.settings.defaultTerms}>
              <Input name="default_payment_terms_days" type="number" min={0} max={365} defaultValue={30} required className="tabular" />
            </Field>
          </div>
          <Field label={c.language} hint={c.languageHint}>
            <Select name="language" defaultValue={locale}>
              <option value="tr">{t.common.turkish}</option>
              <option value="en">{t.common.english}</option>
            </Select>
          </Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 has-[:checked]:border-primary has-[:checked]:bg-accent/40">
            <input type="checkbox" name="load_demo_data" value="on" defaultChecked className="mt-0.5 size-4 accent-[var(--brand)]" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{t.auth.loadDemo}</span>
              <span className="text-[11px] text-muted-foreground">{t.auth.loadDemoHint}</span>
            </span>
          </label>
          {state.error && <p className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-800 dark:text-red-200">{state.error}</p>}
          <SubmitButton variant="brand" className="w-full">
            {t.auth.continue}
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
