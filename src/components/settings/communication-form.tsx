"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateCommunicationSettingsAction } from "@/lib/actions/settings";
import type { FormState } from "@/lib/actions/customers";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale, Organization } from "@/lib/types";

const COPY = {
  tr: { title: "Gönderen bilgileri", hint: "Müşterilerin gördüğü gönderen adı, e-posta ve WhatsApp numarası.", whatsappHint: "Uluslararası formatta, örn. +90 5xx xxx xx xx" },
  en: { title: "Sender identity", hint: "The sender name, email and WhatsApp number customers see.", whatsappHint: "International format, e.g. +90 5xx xxx xx xx" },
};

export function CommunicationForm({ org, t, locale }: { org: Organization; t: Dictionary; locale: Locale }) {
  const [state, formAction] = useActionState<FormState, FormData>(updateCommunicationSettingsAction, {});
  const c = COPY[locale];
  useEffect(() => {
    if (state.success) toast.success(t.settings.saved);
  }, [state, t.settings.saved]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{c.title}</CardTitle>
          <CardDescription>{c.hint}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label={t.settings.senderName}>
            <Input name="sender_name" defaultValue={org.sender_name ?? ""} maxLength={500} />
          </Field>
          <Field label={t.settings.senderEmail}>
            <Input name="sender_email" type="email" defaultValue={org.sender_email ?? ""} />
          </Field>
          <Field label={t.settings.whatsappNumber} hint={c.whatsappHint}>
            <Input name="whatsapp_number" type="tel" defaultValue={org.whatsapp_number ?? ""} maxLength={500} />
          </Field>
        </CardContent>
      </Card>
      {state.error && <p className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-800 dark:text-red-200">{state.error}</p>}
      <div className="flex justify-end">
        <SubmitButton variant="brand">{t.common.save}</SubmitButton>
      </div>
    </form>
  );
}
