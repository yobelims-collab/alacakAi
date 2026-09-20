"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Clock, Loader2, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import { GradeBadge } from "@/components/app/grade-badge";
import { StageBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { approveCommunicationAction, approveManyAction, rejectCommunicationAction, snoozeCommunicationAction } from "@/lib/actions/collection";
import { formatMoney } from "@/lib/domain/money";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Audience, Locale } from "@/lib/types";
import type { QuickItem } from "@/lib/inbox";

export function AudienceChip({ audience, t }: { audience: Audience; t: Dictionary }) {
  const label = audience === "BOTH" ? t.inbox.both : audience === "SALES" ? t.inbox.sales : t.inbox.finance;
  return (
    <Badge variant={audience === "BOTH" ? "violet" : "neutral"}>
      <UserRound /> {label}
    </Badge>
  );
}

export function QuickList({ items, t, locale }: { items: QuickItem[]; t: Dictionary; locale: Locale }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Error");
      else toast.success(okMsg);
      router.refresh();
    });

  const sendAll = () =>
    start(async () => {
      const r = await approveManyAction(items.map((i) => i.comm.id));
      if (!r.ok || !r.data) toast.error(r.error ?? "Error");
      else toast.success(`${r.data.sent} ${t.inbox.sent}${r.data.failed ? `, ${r.data.failed} ${t.inbox.failed}` : ""}`);
      router.refresh();
    });

  if (items.length === 0) return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t.common.noData}</p>;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{items.length} {t.inbox.waiting}</p>
        <Button size="sm" variant="brand" disabled={pending} onClick={sendAll}>
          {pending ? <Loader2 className="animate-spin" /> : <Send />} {t.inbox.sendAll} ({items.length})
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((q) => {
          const expanded = open === q.comm.id;
          const body = edits[q.comm.id] ?? q.comm.body;
          return (
            <li key={q.comm.id} className="rounded-lg border bg-card">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5">
                <GradeBadge grade={q.grade?.grade} t={t} onHold={q.customer.shipments_on_hold} />
                <Link href={`/customers/${q.customer.id}`} className="text-sm font-medium hover:underline">{q.customer.company_name}</Link>
                {q.invoice && (
                  <>
                    <span className="font-mono text-[11px] text-muted-foreground">{q.invoice.invoice_number}</span>
                    <span className="text-sm font-semibold tabular">{formatMoney(q.outstanding, q.invoice.currency, locale)}</span>
                    <span className={`text-xs tabular ${q.daysOverdue > 7 ? "text-orange-700" : "text-muted-foreground"}`}>{q.daysOverdue > 0 ? `${q.daysOverdue} ${t.common.daysOverdue}` : "—"}</span>
                  </>
                )}
                {q.comm.stage && <StageBadge stage={q.comm.stage} t={t} />}
                <AudienceChip audience={q.audience} t={t} />
                <span className="ml-auto flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setOpen(expanded ? null : q.comm.id)} title={q.comm.subject ?? ""}>
                    {expanded ? <ChevronUp /> : <ChevronDown />}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={pending} title={t.inbox.snooze} onClick={() => run(() => snoozeCommunicationAction(q.comm.id, 3), t.inbox.snooze)}>
                    <Clock />
                  </Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => rejectCommunicationAction(q.comm.id), t.inbox.handleMyself)}>
                    {t.inbox.handleMyself}
                  </Button>
                  <Button size="sm" variant="brand" disabled={pending} onClick={() => run(() => approveCommunicationAction({ id: q.comm.id, body: edits[q.comm.id] }), t.inbox.sent)}>
                    <Send /> {t.inbox.send}
                  </Button>
                </span>
              </div>
              {!expanded && <p className="truncate border-t px-3.5 py-2 text-xs text-muted-foreground">{q.comm.subject} — {q.comm.body.replace(/\s+/g, " ").slice(0, 160)}</p>}
              {expanded && (
                <div className="border-t px-3.5 py-3">
                  <p className="mb-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{t.inbox.why}:</span> {q.comm.approval_reason ?? "—"}
                  </p>
                  <p className="mb-2 text-sm font-medium">{q.comm.subject}</p>
                  <Textarea value={body} rows={9} onChange={(e) => setEdits((s) => ({ ...s, [q.comm.id]: e.target.value }))} className="font-sans text-sm" />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
