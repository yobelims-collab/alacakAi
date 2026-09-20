"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { createPaymentAction } from "@/lib/actions/payments";
import type { FormState } from "@/lib/actions/customers";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { CURRENCIES, type Currency, type Locale } from "@/lib/types";

export interface PaymentFormCustomer {
  id: string;
  name: string;
  currency: Currency;
}
export interface PaymentFormInvoice {
  id: string;
  customerId: string;
  currency: Currency;
  label: string;
}

const LOCAL = {
  tr: {
    invoiceHint: "Boş bırakırsanız AI uygun faturayı önerir; fatura durumu siz onaylayana kadar değişmez.",
    customerHint: "İsteğe bağlı. Seçilirse eşleştirme önerileri bu müşteriye öncelik verir.",
    referenceHint: "Banka açıklaması veya dekont referansı; fatura numarası içeriyorsa eşleştirme kolaylaşır.",
    noInvoice: "Fatura seçme — AI önersin",
  },
  en: {
    invoiceHint: "Leave empty and the AI will suggest a matching invoice; invoice status never changes until you confirm.",
    customerHint: "Optional. When set, match suggestions prioritise this customer.",
    referenceHint: "Bank description or remittance reference; including the invoice number makes matching easier.",
    noInvoice: "No invoice — let the AI suggest",
  },
};

export function PaymentForm({ customers, invoices, defaultCurrency, defaultDate, t, locale }: { customers: PaymentFormCustomer[]; invoices: PaymentFormInvoice[]; defaultCurrency: Currency; defaultDate: string; t: Dictionary; locale: Locale }) {
  const [state, formAction] = useActionState<FormState, FormData>(createPaymentAction, {});
  const [customerId, setCustomerId] = useState("");
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const L = LOCAL[locale];
  const visibleInvoices = invoices.filter((i) => i.currency === currency && (!customerId || i.customerId === customerId));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.payments.paymentDate}>
          <Input type="date" name="payment_date" defaultValue={defaultDate} required />
        </Field>
        <Field label={t.common.customer} hint={L.customerHint}>
          <Select
            name="customer_id"
            value={customerId}
            onChange={(e) => {
              const id = e.target.value;
              setCustomerId(id);
              const c = customers.find((x) => x.id === id);
              if (c) setCurrency(c.currency);
            }}
          >
            <option value="">{t.common.optional}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.common.amount}>
          <Input type="text" inputMode="decimal" name="amount" placeholder="18500,00" required className="tabular" />
        </Field>
        <Field label={t.common.currency}>
          <Select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t.common.reference} hint={L.referenceHint}>
        <Input type="text" name="reference" placeholder="INV-2026-00182 HAVALE" maxLength={200} />
      </Field>
      <Field label={t.payments.matchedInvoice} hint={L.invoiceHint}>
        <Select name="matched_invoice_id" defaultValue="">
          <option value="">{L.noInvoice}</option>
          {visibleInvoices.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
            </option>
          ))}
        </Select>
      </Field>
      {state.error && <p className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-800 dark:text-red-200">{state.error}</p>}
      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/payments">{t.common.cancel}</Link>
        </Button>
        <SubmitButton variant="brand" size="sm">
          {t.common.save}
        </SubmitButton>
      </div>
    </form>
  );
}
