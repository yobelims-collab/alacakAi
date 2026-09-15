"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Switch } from "@/components/ui/switch";
import { updateAiSettingsAction } from "@/lib/actions/settings";
import type { FormState } from "@/lib/actions/customers";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { TONES, type Locale, type Organization } from "@/lib/types";

const COPY = {
  tr: { title: "Ajan davranışı", hint: "Yapay zekânın mesaj üretirken ve yanıtları işlerken uyduğu tercihler.", signatureHint: "Her giden mesajın sonuna eklenir." },
  en: { title: "Agent behaviour", hint: "Preferences the AI follows when drafting messages and processing replies.", signatureHint: "Appended to every outbound message." },
};

export function AiForm({ org, t, locale }: { org: Organization; t: Dictionary; locale: Locale }) {
  const [state, formAction] = useActionState<FormState, FormData>(updateAiSettingsAction, {});
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
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4 rounded-lg border p-3.5">
            <div className="flex flex-col gap-1">
              <Label htmlFor="ai_auto_send">{t.settings.aiAutoSend}</Label>
              <p className="text-[11px] text-muted-foreground">{t.settings.aiAutoSendHint}</p>
            </div>
            <Switch id="ai_auto_send" name="ai_auto_send" defaultChecked={org.ai_auto_send} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.settings.aiThreshold} hint={t.settings.aiThresholdHint}>
              <Input name="ai_confidence_threshold" type="number" step="0.05" min="0.5" max="0.99" defaultValue={org.ai_confidence_threshold} required className="tabular" />
            </Field>
            <Field label={t.settings.aiTone}>
              <Select name="ai_default_tone" defaultValue={org.ai_default_tone}>
                {TONES.map((tone) => (
                  <option key={tone} value={tone}>{t.tone[tone]}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t.settings.aiSignature} hint={c.signatureHint}>
            <Textarea name="ai_signature" defaultValue={org.ai_signature ?? ""} rows={3} maxLength={500} />
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
