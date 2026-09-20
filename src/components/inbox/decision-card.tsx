"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ExternalLink, Loader2, PackageCheck, PackageX, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import { GradeBadge } from "@/components/app/grade-badge";
import { SeverityIcon } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { approveCommunicationAction, decideActionAction } from "@/lib/actions/collection";
import { addDays, formatDate, today } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/types";
import type { DecisionItem } from "@/lib/inbox";
import { AudienceChip } from "./quick-list";

export function DecisionCard({ item, t, locale }: { item: DecisionItem; t: Dictionary; locale: Locale }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [variant, setVariant] = useState<"soft" | "firm">("soft");
  const [body, setBody] = useState<string | null>(null);
  const [date, setDate] = useState(addDays(today(), 14));
  const { action: a, customer, invoice, draft, inbound } = item;
  const payload = (a.payload ?? {}) as { intent?: string; requested_extension_days?: number | null; promised_date?: string | null };
  const isExtension = payload.intent === "REQUEST_EXTENSION" || payload.intent === "CASH_FLOW_PROBLEM";
  const draftText = body ?? (draft?.alternatives ? draft.alternatives[variant].body : (draft?.body ?? ""));

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Error");
      else toast.success(okMsg);
      router.refresh();
    });

  return (
    <li className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
        <SeverityIcon severity={a.severity} />
        <GradeBadge grade={item.grade?.grade} t={t} onHold={customer?.shipments_on_hold} />
        {customer ? (
          <Link href={`/customers/${customer.id}`} className="text-sm font-semibold hover:underline">{customer.company_name}</Link>
        ) : (
          <span className="text-sm font-semibold">{a.title}</span>
        )}
        {invoice && (
          <>
            <span className="font-mono text-[11px] text-muted-foreground">{invoice.invoice_number}</span>
            <span className="text-sm font-semibold tabular">{formatMoney(item.outstanding, invoice.currency, locale)}</span>
            {item.daysOverdue > 0 && <span className="text-xs text-red-700 tabular">{item.daysOverdue} {t.common.daysOverdue}</span>}
          </>
        )}
        <AudienceChip audience={item.audience} t={t} />
        <span className="ml-auto text-[11px] text-muted-foreground">{formatDate(a.created_at.slice(0, 10), locale)}</span>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{customer ? a.title.replace(`${customer.company_name}: `, "") : a.type}</p>
            {a.description && <p className="mt-0.5 text-sm">{a.description}</p>}
          </div>
          {inbound && (
            <div className="rounded-lg bg-muted/60 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.inbox.customerSaid}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{inbound.body}</p>
            </div>
          )}
          {item.story.length > 0 && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.inbox.story}</p>
              <ul className="mt-1 list-disc pl-4 text-sm text-foreground/90">
                {item.story.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {a.recommended_action && (
            <p className="text-sm">
              <span className="font-medium">{t.aiActions.recommendedAction}:</span> {a.recommended_action}
            </p>
          )}
          <div className="mt-auto flex flex-wrap gap-1.5">
            {isExtension && invoice && (
              <span className="inline-flex items-center gap-1.5">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-40" aria-label={t.inbox.approveExtensionDate} />
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => decideActionAction({ id: a.id, decision: "APPROVE_EXTENSION", date }), t.inbox.approveExtension)}>
                  <Check /> {t.inbox.approveExtension}
                </Button>
              </span>
            )}
            {customer && !customer.shipments_on_hold && (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => decideActionAction({ id: a.id, decision: "HOLD_SHIPMENTS" }), t.inbox.holdShipments)}>
                <PackageX /> {t.inbox.holdShipments}
              </Button>
            )}
            {customer?.shipments_on_hold && (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => decideActionAction({ id: a.id, decision: "RELEASE_SHIPMENTS" }), t.inbox.releaseShipments)}>
                <PackageCheck /> {t.inbox.releaseShipments}
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => decideActionAction({ id: a.id, decision: "HANDLE_MYSELF" }), t.inbox.handleMyself)}>
              {t.inbox.handleMyself}
            </Button>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => decideActionAction({ id: a.id, decision: "RESOLVE" }), t.inbox.resolve)}>
              <Check /> {t.inbox.resolve}
            </Button>
            {customer && (
              <Button asChild size="sm" variant="ghost">
                <Link href={`/customers/${customer.id}`}>
                  <ExternalLink /> {t.aiActions.viewCustomer}
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
          {draft ? (
            <>
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.communications.body}</p>
                {draft.alternatives && (
                  <span className="ml-auto inline-flex rounded-md border p-0.5 text-xs">
                    {(["soft", "firm"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setVariant(v);
                          setBody(null);
                        }}
                        className={`rounded px-2 py-0.5 font-medium ${variant === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {v === "soft" ? t.inbox.draftSoft : t.inbox.draftFirm}
                      </button>
                    ))}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium">{draft.alternatives ? draft.alternatives[variant].subject : draft.subject}</p>
              <Textarea value={draftText} rows={10} onChange={(e) => setBody(e.target.value)} className="text-sm" />
              <div className="flex items-center justify-end gap-1.5">
                <Button size="sm" variant="brand" disabled={pending} onClick={() => run(() => approveCommunicationAction({ id: draft.id, variant, body: body ?? undefined }), t.inbox.sent)}>
                  {pending ? <Loader2 className="animate-spin" /> : <Send />} {t.communications.approveSend}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                <UserRound className="mr-1 inline size-3" />
                {t.inbox.why}: {draft.approval_reason ?? a.description}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t.common.noData}</p>
          )}
        </div>
      </div>
    </li>
  );
}
