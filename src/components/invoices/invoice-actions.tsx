"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, MessageSquareText, RotateCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { draftReminderAction, setInvoiceStatusAction } from "@/lib/actions/collection";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { TONES, type CollectionStage, type InvoiceStatus, type Locale, type Tone } from "@/lib/types";

const DRAFT_STAGES: CollectionStage[] = ["PRE_DUE", "DUE_TODAY", "OVERDUE_EARLY", "OVERDUE_MID", "ESCALATED"];

const LABELS = {
  tr: { reopen: "Yeniden aç", confirmPaid: "Bu fatura ödendi olarak işaretlensin mi?", confirmDisputed: "Bu fatura itirazlı olarak işaretlensin mi? Hatırlatmalar durur.", confirmEscalate: "Bu fatura eskale edilsin mi?", confirmReopen: "Fatura yeniden açılsın mı?", drafted: "Hatırlatma taslağı oluşturuldu", statusChanged: "Fatura durumu güncellendi" },
  en: { reopen: "Reopen", confirmPaid: "Mark this invoice as paid?", confirmDisputed: "Mark this invoice as disputed? Reminders will stop.", confirmEscalate: "Escalate this invoice?", confirmReopen: "Reopen this invoice?", drafted: "Reminder draft created", statusChanged: "Invoice status updated" },
};

function defaultStage(status: InvoiceStatus, daysOverdue: number, stage: CollectionStage): CollectionStage {
  if (stage !== "NONE") return stage;
  if (status === "ESCALATED") return "ESCALATED";
  if (daysOverdue > 30) return "ESCALATED";
  if (daysOverdue > 7) return "OVERDUE_MID";
  if (daysOverdue > 0) return "OVERDUE_EARLY";
  if (status === "DUE_TODAY") return "DUE_TODAY";
  return "PRE_DUE";
}

export function InvoiceActions({ t, locale, invoiceId, customerId, status, daysOverdue, collectionStage, defaultTone }: { t: Dictionary; locale: Locale; invoiceId: string; customerId: string; status: InvoiceStatus; daysOverdue: number; collectionStage: CollectionStage; defaultTone: Tone }) {
  const L = LABELS[locale];
  const router = useRouter();
  const [pending, start] = useTransition();
  const [stage, setStage] = useState<CollectionStage>(defaultStage(status, daysOverdue, collectionStage));
  const [tone, setTone] = useState<Tone>(defaultTone);

  const setStatus = (next: "PAID" | "DISPUTED" | "ESCALATED" | "SENT", confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    start(async () => {
      const r = await setInvoiceStatusAction(invoiceId, next);
      if (!r.ok) toast.error(r.error ?? "Error");
      else toast.success(`${L.statusChanged}: ${t.status[next]}`);
      router.refresh();
    });
  };

  const draft = () =>
    start(async () => {
      const r = await draftReminderAction({ invoiceId, stage, tone });
      if (!r.ok || !r.data) {
        toast.error(r.error ?? "Error");
        return;
      }
      toast.success(`${L.drafted} · ${t.status[r.data.status as keyof typeof t.status] ?? r.data.status}`);
      router.push(`/communications?customer=${customerId}`);
    });

  const closed = status === "PAID" || status === "DISPUTED" || status === "ESCALATED";
  const canDraft = status !== "PAID" && status !== "DRAFT" && status !== "DISPUTED";

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={stage} onChange={(e) => setStage(e.target.value as CollectionStage)} className="w-44" aria-label={t.invoices.stage} disabled={!canDraft || pending}>
          {DRAFT_STAGES.map((s) => (
            <option key={s} value={s}>
              {t.stage[s]}
            </option>
          ))}
        </Select>
        <Select value={tone} onChange={(e) => setTone(e.target.value as Tone)} className="w-36" aria-label={t.communications.tone} disabled={!canDraft || pending}>
          {TONES.map((x) => (
            <option key={x} value={x}>
              {t.tone[x]}
            </option>
          ))}
        </Select>
        <Button variant="brand" size="sm" onClick={draft} disabled={!canDraft || pending}>
          {pending ? <Loader2 className="animate-spin" /> : <MessageSquareText />} {t.invoices.generateMessage}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status !== "PAID" && (
          <Button variant="outline" size="sm" onClick={() => setStatus("PAID", L.confirmPaid)} disabled={pending}>
            <CheckCircle2 className="text-emerald-600" /> {t.invoices.markPaid}
          </Button>
        )}
        {status !== "PAID" && status !== "DISPUTED" && (
          <Button variant="outline" size="sm" onClick={() => setStatus("DISPUTED", L.confirmDisputed)} disabled={pending}>
            <AlertTriangle className="text-orange-600" /> {t.invoices.markDisputed}
          </Button>
        )}
        {status !== "PAID" && status !== "ESCALATED" && status !== "DISPUTED" && (
          <Button variant="destructive" size="sm" onClick={() => setStatus("ESCALATED", L.confirmEscalate)} disabled={pending}>
            <ShieldAlert /> {t.invoices.escalate}
          </Button>
        )}
        {closed && (
          <Button variant="ghost" size="sm" onClick={() => setStatus("SENT", L.confirmReopen)} disabled={pending}>
            <RotateCcw /> {L.reopen}
          </Button>
        )}
      </div>
    </div>
  );
}
