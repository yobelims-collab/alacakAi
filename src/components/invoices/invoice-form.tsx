"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/actions/customers";
import { createInvoiceAction } from "@/lib/actions/invoices";
import { addDays, today } from "@/lib/domain/dates";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { CURRENCIES, type Currency } from "@/lib/types";

export interface InvoiceFormCustomer {
  id: string;
  company_name: string;
  payment_terms_days: number;
  currency: Currency;
}

export function InvoiceForm({ t, customers, defaults, initialCustomerId }: { t: Dictionary; customers: InvoiceFormCustomer[]; defaults: { paymentTermsDays: number; currency: Currency }; initialCustomerId?: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(createInvoiceAction, {});
  const first = customers.find((c) => c.id === initialCustomerId) ?? customers[0];
  const [customerId, setCustomerId] = useState(first?.id ?? "");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [dueTouched, setDueTouched] = useState(false);
  const [dueDate, setDueDate] = useState(addDays(today(), first?.payment_terms_days ?? defaults.paymentTermsDays));
  const [currency, setCurrency] = useState<Currency>(first?.currency ?? defaults.currency);

  const termsFor = (id: string) => customers.find((c) => c.id === id)?.payment_terms_days ?? defaults.paymentTermsDays;
  const syncDue = (date: string, id: string) => {
    if (!dueTouched && /^\d{4}-\d{2}-\d{2}$/.test(date)) setDueDate(addDays(date, termsFor(id)));
  };

  return (
    <form action={formAction}>
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label={t.common.customer} className="sm:col-span-2">
            <Select
              name="customer_id"
              required
              value={customerId}
              onChange={(e) => {
                const id = e.target.value;
                setCustomerId(id);
                const c = customers.find((x) => x.id === id);
                if (c) setCurrency(c.currency);
                syncDue(invoiceDate, id);
              }}
            >
              {customers.length === 0 && <option value="">—</option>}
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.invoices.number}>
            <Input name="invoice_number" required maxLength={64} placeholder="INV-2026-00001" autoFocus />
          </Field>
          <Field label={t.common.status}>
            <Select name="status" defaultValue="SENT">
              <option value="SENT">{t.status.SENT}</option>
              <option value="DRAFT">{t.status.DRAFT}</option>
            </Select>
          </Field>
          <Field label={t.invoices.invoiceDate}>
            <Input
              name="invoice_date"
              type="date"
              required
              value={invoiceDate}
              onChange={(e) => {
                setInvoiceDate(e.target.value);
                syncDue(e.target.value, customerId);
              }}
            />
          </Field>
          <Field label={t.invoices.dueDate} hint={`${t.customers.paymentTerms}: ${termsFor(customerId)}`}>
            <Input
              name="due_date"
              type="date"
              required
              min={invoiceDate}
              value={dueDate}
              onChange={(e) => {
                setDueTouched(true);
                setDueDate(e.target.value);
              }}
            />
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
          <Field label={t.common.amount}>
            <Input name="amount" type="number" required min={0.01} step="0.01" inputMode="decimal" />
          </Field>
          <Field label={t.invoices.paid} hint={t.common.optional}>
            <Input name="paid_amount" type="number" min={0} step="0.01" inputMode="decimal" defaultValue={0} />
          </Field>
          <Field label={t.invoices.description} className="sm:col-span-2">
            <Textarea name="description" maxLength={500} />
          </Field>

          {state.error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 sm:col-span-2">
              {state.error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 sm:col-span-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/invoices">{t.common.cancel}</Link>
            </Button>
            <SubmitButton variant="brand" size="sm" disabled={customers.length === 0}>
              {t.common.create}
            </SubmitButton>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
