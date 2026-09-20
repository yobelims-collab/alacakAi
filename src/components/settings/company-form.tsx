"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateCompanyAction } from "@/lib/actions/settings";
import type { FormState } from "@/lib/actions/customers";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { CURRENCIES, type Locale, type Organization } from "@/lib/types";

const COPY = {
  tr: {
    general: "Genel bilgiler",
    generalHint: "Müşterilere giden mesajlarda şirket adı bu alandan alınır.",
    defaults: "Varsayılanlar",
    defaultsHint: "Yeni müşteri ve faturalar için başlangıç değerleri.",
    orgLanguage: "Şirket dili",
    orgLanguageHint: "Yeni müşterilerin varsayılan yazışma dili. Arayüz dili ayrı olarak seçilir.",
    fx: "Kur tablosu",
    eur: "1 EUR =",
    usd: "1 USD =",
    gbp: "1 GBP =",
  },
  en: {
    general: "General",
    generalHint: "Outbound messages use this company name.",
    defaults: "Defaults",
    defaultsHint: "Starting values for new customers and invoices.",
    orgLanguage: "Company language",
    orgLanguageHint: "Default correspondence language for new customers. The interface language is chosen separately.",
    fx: "FX table",
    eur: "1 EUR =",
    usd: "1 USD =",
    gbp: "1 GBP =",
  },
};

export function CompanyForm({ org, t, locale }: { org: Organization; t: Dictionary; locale: Locale }) {
  const [state, formAction] = useActionState<FormState, FormData>(updateCompanyAction, {});
  const c = COPY[locale];
  useEffect(() => {
    if (state.success) toast.success(t.settings.saved);
  }, [state, t.settings.saved]);

  const fx = (code: string) => org.fx_rates?.[code] ?? "";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{c.general}</CardTitle>
          <CardDescription>{c.generalHint}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label={t.settings.companyName} className="sm:col-span-2">
            <Input name="name" defaultValue={org.name} required minLength={2} maxLength={200} />
          </Field>
          <Field label={t.settings.logo}>
            <Input name="logo_url" type="url" defaultValue={org.logo_url ?? ""} placeholder="https://" />
          </Field>
          <Field label={t.settings.taxNumber}>
            <Input name="tax_number" defaultValue={org.tax_number ?? ""} />
          </Field>
          <Field label={t.settings.address} className="sm:col-span-2">
            <Textarea name="address" defaultValue={org.address ?? ""} rows={2} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{c.defaults}</CardTitle>
          <CardDescription>{c.defaultsHint}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label={t.settings.defaultCurrency}>
            <Select name="default_currency" defaultValue={org.default_currency}>
              {CURRENCIES.map((cur) => (
                <option key={cur} value={cur}>{cur}</option>
              ))}
            </Select>
          </Field>
          <Field label={t.settings.reportingCurrency}>
            <Select name="reporting_currency" defaultValue={org.reporting_currency}>
              {CURRENCIES.map((cur) => (
                <option key={cur} value={cur}>{cur}</option>
              ))}
            </Select>
          </Field>
          <Field label={t.settings.defaultTerms}>
            <Input name="default_payment_terms_days" type="number" min={0} max={365} defaultValue={org.default_payment_terms_days} required />
          </Field>
          <Field label={locale === "tr" ? `Onay eşiği (${org.reporting_currency})` : `Approval threshold (${org.reporting_currency})`} hint={locale === "tr" ? "Bu tutarın üzerindeki faturalarda vade öncesi hatırlatma bile insan onayı ister." : "Above this amount even a pre-due reminder needs human approval."}>
            <Input name="approval_amount_threshold" type="number" min={0} step="1000" defaultValue={org.approval_amount_threshold} className="tabular" />
          </Field>
          <Field label={c.orgLanguage} hint={c.orgLanguageHint}>
            <Select name="language" defaultValue={org.language}>
              <option value="tr">{t.common.turkish}</option>
              <option value="en">{t.common.english}</option>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.fxRates}</CardTitle>
          <CardDescription>{t.settings.fxHint}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label={`${c.eur} ${org.reporting_currency}`}>
            <Input name="fx_eur" type="number" step="0.0001" min="0.0001" defaultValue={fx("EUR")} required className="tabular" />
          </Field>
          <Field label={`${c.usd} ${org.reporting_currency}`}>
            <Input name="fx_usd" type="number" step="0.0001" min="0.0001" defaultValue={fx("USD")} required className="tabular" />
          </Field>
          <Field label={`${c.gbp} ${org.reporting_currency}`}>
            <Input name="fx_gbp" type="number" step="0.0001" min="0.0001" defaultValue={fx("GBP")} required className="tabular" />
          </Field>
        </CardContent>
      </Card>

      {state.error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{state.error}</p>}
      <div className="flex justify-end">
        <SubmitButton variant="brand">{t.common.save}</SubmitButton>
      </div>
    </form>
  );
}
