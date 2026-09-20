"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Switch } from "@/components/ui/switch";
import { updateAutomationAction } from "@/lib/actions/settings";
import type { FormState } from "@/lib/actions/customers";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { CHANNELS, type AutomationRule, type Locale } from "@/lib/types";
import { cn } from "@/lib/utils";

const COPY = {
  tr: {
    stages: "Hatırlatma aşamaları",
    stagesHint: "Aşamalar açık olduğunda AI döngüsü her fatura için en fazla bir mesaj taslağı üretir.",
    channelsHint: "Müşterinin iletişim bilgisi olan ilk kanal kullanılır.",
    approvalHint: "Açıkken hiçbir mesaj onaysız gönderilmez; AI otomatik gönderim ayarından bağımsızdır.",
    timeline: "Takvim",
    timelineHint: "Girdiğiniz değerlere göre bir faturanın vade etrafındaki yolculuğu.",
    beforeDue: (d: number) => `Vadeden ${d} gün önce`,
    onDue: "Vade günü",
    afterDue: (d: number) => `Vadeden ${d} gün sonra`,
    between: (a: number, b: number) => `${a}–${b} gün gecikme`,
    escalation: (d: number) => `${d}+ gün gecikme → insana eskalasyon`,
    off: "Kapalı",
  },
  en: {
    stages: "Reminder stages",
    stagesHint: "When a stage is on, the AI cycle drafts at most one message per invoice for it.",
    channelsHint: "The first channel the customer has contact details for is used.",
    approvalHint: "When on, no message is sent without approval, regardless of the AI auto-send setting.",
    timeline: "Timeline",
    timelineHint: "An invoice's journey around its due date, based on the values you entered.",
    beforeDue: (d: number) => `${d} days before due`,
    onDue: "Due day",
    afterDue: (d: number) => `${d} days after due`,
    between: (a: number, b: number) => `${a}–${b} days overdue`,
    escalation: (d: number) => `${d}+ days overdue → escalated to a human`,
    off: "Off",
  },
};

const num = (v: string, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== "" ? n : fallback;
};

export function AutomationForm({ rules, t, locale }: { rules: AutomationRule; t: Dictionary; locale: Locale }) {
  const [state, formAction] = useActionState<FormState, FormData>(updateAutomationAction, {});
  const c = COPY[locale];
  useEffect(() => {
    if (state.success) toast.success(t.settings.saved);
  }, [state, t.settings.saved]);

  const [preDue, setPreDue] = useState(rules.pre_due_enabled);
  const [dueDate, setDueDate] = useState(rules.due_date_enabled);
  const [overdue, setOverdue] = useState(rules.overdue_enabled);
  const [preDueDays, setPreDueDays] = useState(String(rules.pre_due_days));
  const [first, setFirst] = useState(String(rules.first_reminder_days));
  const [second, setSecond] = useState(String(rules.second_reminder_days));
  const [esc, setEsc] = useState(String(rules.escalation_days));

  const p = num(preDueDays, rules.pre_due_days);
  const f = num(first, rules.first_reminder_days);
  const s = num(second, rules.second_reminder_days);
  const e = num(esc, rules.escalation_days);

  const timeline = [
    { label: t.stage.PRE_DUE, detail: c.beforeDue(p), on: preDue },
    { label: t.stage.DUE_TODAY, detail: c.onDue, on: dueDate },
    { label: t.stage.OVERDUE_EARLY, detail: `${c.afterDue(f)} · ${c.between(f, Math.max(f, s - 1))}`, on: overdue },
    { label: t.stage.OVERDUE_MID, detail: `${c.afterDue(s)} · ${c.between(s, Math.max(s, e - 1))}`, on: overdue },
    { label: t.stage.ESCALATED, detail: c.escalation(e), on: overdue },
  ];

  return (
    <form action={formAction} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{c.stages}</CardTitle>
            <CardDescription>{c.stagesHint}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-3 rounded-lg border p-3.5 sm:grid-cols-[1fr_180px] sm:items-center">
              <div className="flex items-center gap-3">
                <Switch id="pre_due_enabled" name="pre_due_enabled" checked={preDue} onCheckedChange={setPreDue} />
                <Label htmlFor="pre_due_enabled">{t.settings.preDue}</Label>
              </div>
              <Field label={t.settings.preDueDays}>
                <Input name="pre_due_days" type="number" min={1} max={30} value={preDueDays} onChange={(ev) => setPreDueDays(ev.target.value)} disabled={!preDue} required className="tabular" />
              </Field>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3.5">
              <Switch id="due_date_enabled" name="due_date_enabled" checked={dueDate} onCheckedChange={setDueDate} />
              <Label htmlFor="due_date_enabled">{t.settings.dueDate}</Label>
            </div>
            <div className="grid gap-3 rounded-lg border p-3.5">
              <div className="flex items-center gap-3">
                <Switch id="overdue_enabled" name="overdue_enabled" checked={overdue} onCheckedChange={setOverdue} />
                <Label htmlFor="overdue_enabled">{t.settings.overdue}</Label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={t.settings.firstReminder}>
                  <Input name="first_reminder_days" type="number" min={1} max={60} value={first} onChange={(ev) => setFirst(ev.target.value)} required className="tabular" />
                </Field>
                <Field label={t.settings.secondReminder}>
                  <Input name="second_reminder_days" type="number" min={2} max={90} value={second} onChange={(ev) => setSecond(ev.target.value)} required className="tabular" />
                </Field>
                <Field label={t.settings.escalation}>
                  <Input name="escalation_days" type="number" min={3} max={180} value={esc} onChange={(ev) => setEsc(ev.target.value)} required className="tabular" />
                </Field>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.settings.channels}</CardTitle>
            <CardDescription>{c.channelsHint}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-4">
              {CHANNELS.map((ch) => (
                <label key={ch} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent/50">
                  <input type="checkbox" name={`channel_${ch}`} value="on" defaultChecked={rules.channels.includes(ch)} className="size-4 accent-[var(--brand)]" />
                  {t.channel[ch]}
                </label>
              ))}
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border p-3.5">
              <div className="flex flex-col gap-1">
                <Label htmlFor="auto_send_pre_due">{locale === "tr" ? "Vade öncesi hatırlatmaları otomatik gönder" : "Send pre-due reminders automatically"}</Label>
                <p className="text-[11px] text-muted-foreground">{locale === "tr" ? "AI'nın kendi başına gönderdiği tek mesaj türü. Vade sonrası her mesaj Gelen Kutusu'nda onay bekler." : "The only message type the AI sends on its own. Everything after the due date waits in the Inbox."}</p>
              </div>
              <Switch id="auto_send_pre_due" name="auto_send_pre_due" defaultChecked={rules.auto_send_pre_due} />
            </div>
            <Field label={locale === "tr" ? "Satış ekibi kaç gün gecikmeden sonra devreye girsin" : "Loop in sales after (days overdue)"} hint={locale === "tr" ? "Bu günden itibaren kartlar hesap yöneticisine de gösterilir." : "From this day the cards are also shown to the account manager."}>
              <Input name="sales_involved_after_days" type="number" min={0} max={180} defaultValue={rules.sales_involved_after_days} required className="tabular" />
            </Field>
            <div className="flex items-start justify-between gap-4 rounded-lg border p-3.5">
              <div className="flex flex-col gap-1">
                <Label htmlFor="require_approval">{t.settings.requireApproval}</Label>
                <p className="text-[11px] text-muted-foreground">{c.approvalHint}</p>
              </div>
              <Switch id="require_approval" name="require_approval" defaultChecked={rules.require_approval} />
            </div>
          </CardContent>
        </Card>

        {state.error && <p className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-800 dark:text-red-200">{state.error}</p>}
        <div className="flex justify-end">
          <SubmitButton variant="brand">{t.common.save}</SubmitButton>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{c.timeline}</CardTitle>
          <CardDescription>{c.timelineHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="relative flex flex-col gap-4 border-l pl-4">
            {timeline.map((step, i) => (
              <li key={i} className="relative">
                <span className={cn("absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-background ring-1", step.on ? "bg-brand ring-brand" : "bg-muted ring-border")} />
                <p className={cn("text-sm font-medium", !step.on && "text-muted-foreground line-through")}>{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.on ? step.detail : c.off}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </form>
  );
}
