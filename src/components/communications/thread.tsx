"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Bot, Check, Info, Loader2, Mail, MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";
import { CommStatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { approveCommunicationAction, rejectCommunicationAction, simulateReplyAction } from "@/lib/actions/collection";
import { formatDate, formatDateTime } from "@/lib/domain/dates";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { CHANNELS, INTENTS, type Channel, type Communication, type Intent, type Locale } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ThreadMessage = Communication & { invoiceNumber: string | null };
export interface ThreadInvoiceOption {
  id: string;
  label: string;
}

const LOCAL = {
  tr: {
    engine: "Motor",
    engineRules: "Kural tabanlı",
    engineLlm: "Dil modeli",
    requiresHuman: "İnsan müdahalesi gerekli",
    escalated: "İnsan müdahalesine yönlendirildi",
    rejected: "Mesaj reddedildi",
    approvedSent: "Onaylandı",
    aiDraft: "AI taslağı",
    noInvoice: "Fatura belirtme",
    summary: "Özet",
  },
  en: {
    engine: "Engine",
    engineRules: "Rule-based",
    engineLlm: "Language model",
    requiresHuman: "Requires human attention",
    escalated: "Escalated to a human",
    rejected: "Message rejected",
    approvedSent: "Approved",
    aiDraft: "AI draft",
    noInvoice: "No specific invoice",
    summary: "Summary",
  },
};

function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  const Icon = channel === "WHATSAPP" ? MessageCircle : Mail;
  return <Icon className={cn("size-3.5 shrink-0", className)} />;
}

export function Thread({ customer, messages, invoices, highlightId, t, locale }: { customer: { id: string; name: string }; messages: ThreadMessage[]; invoices: ThreadInvoiceOption[]; highlightId?: string; t: Dictionary; locale: Locale }) {
  useEffect(() => {
    if (!highlightId) return;
    document.getElementById(`msg-${highlightId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightId]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>{t.communications.thread}</CardTitle>
            <CardDescription>
              <Link href={`/customers/${customer.id}`} className="hover:underline">
                {customer.name}
              </Link>{" "}
              · {messages.length}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} highlighted={m.id === highlightId} t={t} locale={locale} />
          ))}
          <div className="mt-2 flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>{t.communications.providerNote}</span>
          </div>
        </CardContent>
      </Card>

      <SimulateReply customerId={customer.id} invoices={invoices} t={t} locale={locale} />
    </div>
  );
}

function MessageBubble({ message: m, highlighted, t, locale }: { message: ThreadMessage; highlighted: boolean; t: Dictionary; locale: Locale }) {
  const L = LOCAL[locale];
  const outbound = m.direction === "OUTBOUND";
  const c = m.classification;
  return (
    <div id={`msg-${m.id}`} className={cn("flex w-full", outbound ? "justify-end" : "justify-start")}>
      <div className={cn("w-full max-w-[85%] rounded-lg border p-3 text-sm transition-shadow", outbound ? "bg-card" : "bg-muted/40", highlighted && "ring-2 ring-brand/50")}>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <ChannelIcon channel={m.channel} />
          <span>{t.channel[m.channel]}</span>
          <span>·</span>
          <span>{outbound ? t.communications.outbound : t.communications.inbound}</span>
          {m.invoiceNumber && (
            <>
              <span>·</span>
              <Link href={`/invoices/${m.invoice_id}`} className="font-mono hover:underline">
                {m.invoiceNumber}
              </Link>
            </>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            <CommStatusBadge status={m.status} t={t} />
            <span className="tabular">{formatDateTime(m.sent_at ?? m.created_at, locale)}</span>
          </span>
        </div>
        {outbound && m.subject && <p className="mt-2 font-medium">{m.subject}</p>}
        <p className={cn("whitespace-pre-wrap text-sm leading-relaxed", outbound && m.subject ? "mt-1" : "mt-2")}>{m.body}</p>
        {outbound && (m.stage || m.tone || m.ai_generated) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {m.stage && m.stage !== "NONE" && <Badge variant="info">{t.stage[m.stage]}</Badge>}
            {m.tone && <Badge variant="neutral">{t.tone[m.tone]}</Badge>}
            {m.ai_generated && (
              <Badge variant="violet">
                <Bot /> {L.aiDraft}
              </Badge>
            )}
          </div>
        )}
        {m.status === "SENT_SIMULATED" && <p className="mt-2 text-[11px] text-muted-foreground">{t.communications.sentSimulated}</p>}
        {!outbound && c && (
          <div className="mt-3 rounded-md border bg-background p-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.communications.extracted}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="violet">{t.intent[c.intent]}</Badge>
              <Badge variant={c.confidence >= 0.8 ? "success" : c.confidence >= 0.5 ? "warning" : "neutral"}>
                {t.common.confidence} {Math.round(c.confidence * 100)}%
              </Badge>
              <Badge variant={c.urgency === "HIGH" ? "critical" : c.urgency === "MEDIUM" ? "warning" : "neutral"}>
                {t.communications.urgency}: {t.risk[c.urgency]}
              </Badge>
              {c.requires_human && <Badge variant="critical">{L.requiresHuman}</Badge>}
            </div>
            <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
              {c.promised_date && (
                <Row label={t.communications.promisedDate}>{formatDate(c.promised_date, locale)}</Row>
              )}
              {c.requested_extension_days !== null && (
                <Row label={t.communications.extensionDays}>
                  {c.requested_extension_days} {t.common.days}
                </Row>
              )}
              {c.disputed_amount !== null && <Row label={t.communications.disputedAmount}>{c.disputed_amount.toLocaleString(locale === "tr" ? "tr-TR" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Row>}
              {c.reason && <Row label={t.communications.reason}>{c.reason}</Row>}
              {c.summary && <Row label={L.summary}>{c.summary}</Row>}
              <Row label={L.engine}>{c.engine === "llm" ? L.engineLlm : L.engineRules}</Row>
            </dl>
          </div>
        )}
        {outbound && m.status === "PENDING_APPROVAL" && <ApprovalPanel message={m} t={t} locale={locale} />}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular">{children}</dd>
    </div>
  );
}

function ApprovalPanel({ message, t, locale }: { message: ThreadMessage; t: Dictionary; locale: Locale }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [subject, setSubject] = useState(message.subject ?? "");
  const [body, setBody] = useState(message.body);
  const L = LOCAL[locale];
  const approve = () =>
    start(async () => {
      const r = await approveCommunicationAction({ id: message.id, subject: message.channel === "EMAIL" && subject.trim() ? subject.trim() : undefined, body: body.trim() });
      if (!r.ok) toast.error(r.error ?? "Error");
      else toast.success(r.data?.status === "SENT_SIMULATED" ? t.communications.sentSimulated : `${L.approvedSent} · ${t.communications.sentReal}`);
      router.refresh();
    });
  const reject = () =>
    start(async () => {
      const r = await rejectCommunicationAction(message.id);
      if (!r.ok) toast.error(r.error ?? "Error");
      else toast.success(L.rejected);
      router.refresh();
    });
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50/40 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200">{t.communications.pendingApproval}</p>
      {message.channel === "EMAIL" && (
        <Field label={t.communications.subject}>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} disabled={pending} />
        </Field>
      )}
      <Field label={t.communications.body}>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} maxLength={2500} disabled={pending} />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="brand" disabled={pending || body.trim().length < 20} onClick={approve}>
          {pending ? <Loader2 className="animate-spin" /> : <Check />} {t.communications.approveSend}
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={reject}>
          <X /> {t.common.reject}
        </Button>
      </div>
    </div>
  );
}

function SimulateReply({ customerId, invoices, t, locale }: { customerId: string; invoices: ThreadInvoiceOption[]; t: Dictionary; locale: Locale }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [channel, setChannel] = useState<Channel>("EMAIL");
  const L = LOCAL[locale];
  const submit = () =>
    start(async () => {
      const r = await simulateReplyAction({ customerId, invoiceId: invoiceId || null, channel, body });
      if (!r.ok || !r.data) {
        toast.error(r.error ?? "Error");
        return;
      }
      const intentLabel = INTENTS.includes(r.data.intent as Intent) ? t.intent[r.data.intent as Intent] : r.data.intent;
      const parts = [`${intentLabel} · ${t.common.confidence} ${Math.round(r.data.confidence * 100)}%`];
      if (r.data.promisedDate) parts.push(`${t.communications.promisedDate}: ${formatDate(r.data.promisedDate, locale)}`);
      if (r.data.escalated) parts.push(L.escalated);
      toast.success(parts.join(" · "));
      setBody("");
      router.refresh();
    });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.communications.simulateReply}</CardTitle>
        <CardDescription>{t.communications.simulateReplyHint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t.communications.replyPlaceholder} rows={3} maxLength={3000} disabled={pending} />
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <Field label={t.common.invoice}>
            <Select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} disabled={pending}>
              <option value="">{L.noInvoice}</option>
              {invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.communications.channel}>
            <Select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} disabled={pending}>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {t.channel[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Button variant="brand" size="sm" className="h-9" disabled={pending || body.trim().length < 2} onClick={submit}>
            {pending ? <Loader2 className="animate-spin" /> : <Send />} {t.communications.classify}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
