"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { createCustomerAction, updateCustomerAction, type FormState } from "@/lib/actions/customers";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { CURRENCIES, type Currency, type Customer, type Locale } from "@/lib/types";

export interface CustomerFormProps {
  t: Dictionary;
  /** When present the form updates this customer; otherwise it creates a new one. */
  customer?: Customer;
  defaults: { paymentTermsDays: number; currency: Currency; language: Locale };
  /** Org members that can be picked as account manager (sales owner). */
  managers?: { id: string; full_name: string; email: string }[];
  locale?: Locale;
}

const MANAGER_COPY = {
  tr: { label: "Hesap yöneticisi (satış)", none: "— Yok", hint: "Satış rolündeki kullanıcılar yalnızca kendi müşterilerini görür." },
  en: { label: "Account manager (sales)", none: "— None", hint: "Sales users only see the customers they manage." },
};

export function CustomerForm({ t, customer, defaults, managers = [], locale = "tr" }: CustomerFormProps) {
  const mc = MANAGER_COPY[locale];
  const action = customer ? updateCustomerAction.bind(null, customer.id) : createCustomerAction;
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  useEffect(() => {
    if (state.success) toast.success(t.settings.saved);
  }, [state, t.settings.saved]);

  return (
    <form action={formAction}>
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label={t.customers.companyName} className="sm:col-span-2">
            <Input name="company_name" required minLength={2} maxLength={200} defaultValue={customer?.company_name ?? ""} autoFocus />
          </Field>
          <Field label={t.customers.contactPerson}>
            <Input name="contact_person" defaultValue={customer?.contact_person ?? ""} />
          </Field>
          <Field label={t.customers.email}>
            <Input name="email" type="email" defaultValue={customer?.email ?? ""} />
          </Field>
          <Field label={t.customers.phone}>
            <Input name="phone" type="tel" defaultValue={customer?.phone ?? ""} />
          </Field>
          <Field label={t.customers.whatsapp}>
            <Input name="whatsapp_number" type="tel" defaultValue={customer?.whatsapp_number ?? ""} />
          </Field>
          <Field label={t.customers.country}>
            <Input name="country" defaultValue={customer?.country ?? ""} />
          </Field>
          <Field label={t.customers.preferredLanguage}>
            <Select name="preferred_language" defaultValue={customer?.preferred_language ?? defaults.language}>
              <option value="tr">{t.common.turkish}</option>
              <option value="en">{t.common.english}</option>
            </Select>
          </Field>
          <Field label={t.customers.paymentTerms}>
            <Input name="payment_terms_days" type="number" min={0} max={365} step={1} defaultValue={customer?.payment_terms_days ?? defaults.paymentTermsDays} />
          </Field>
          <Field label={t.customers.creditLimit} hint={t.common.optional}>
            <Input name="credit_limit" type="number" min={0} step="0.01" inputMode="decimal" defaultValue={customer?.credit_limit ?? ""} />
          </Field>
          <Field label={t.common.currency}>
            <Select name="currency" defaultValue={customer?.currency ?? defaults.currency}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={mc.label} hint={mc.hint} className="sm:col-span-2">
            <Select name="account_manager_id" defaultValue={customer?.account_manager_id ?? ""}>
              <option value="">{mc.none}</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.email}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.customers.notes} className="sm:col-span-2">
            <Textarea name="notes" maxLength={500} defaultValue={customer?.notes ?? ""} />
          </Field>

          {state.error && (
            <p role="alert" className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-800 dark:text-red-200 sm:col-span-2">
              {state.error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 sm:col-span-2">
            <Button asChild variant="ghost" size="sm">
              <Link href={customer ? `/customers/${customer.id}` : "/customers"}>{t.common.cancel}</Link>
            </Button>
            <SubmitButton variant="brand" size="sm">
              {customer ? t.common.save : t.common.create}
            </SubmitButton>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
