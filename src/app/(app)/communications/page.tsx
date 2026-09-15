import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { RunCycleButton } from "@/components/app/run-cycle-button";
import { Thread, type ThreadInvoiceOption } from "@/components/communications/thread";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireContext } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/domain/dates";
import { isOpen, outstanding } from "@/lib/domain/invoices";
import { formatMoney } from "@/lib/domain/money";
import { cn } from "@/lib/utils";
import type { Communication } from "@/lib/types";

export const metadata = { title: "Communications" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const LOCAL = {
  tr: { customers: "Müşteriler", noPending: "Onay bekleyen mesaj yok." },
  en: { customers: "Customers", noPending: "No messages awaiting approval." },
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

interface Group {
  customerId: string;
  messages: Communication[];
  last: Communication;
  latestInbound: Communication | undefined;
  nextAction: Communication | undefined;
  pending: number;
}

export default async function CommunicationsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const { t, locale } = ctx;
  const L = LOCAL[locale];
  const onlyPending = first(sp.status) === "PENDING_APPROVAL";
  const replyId = first(sp.reply);

  const [communications, customers, invoices] = await Promise.all([ctx.store.list("communications", { orderBy: "created_at", ascending: true }), ctx.store.list("customers"), ctx.store.list("invoices")]);
  const custBy = new Map(customers.map((c) => [c.id, c]));
  const invBy = new Map(invoices.map((i) => [i.id, i]));

  const byCustomer = new Map<string, Communication[]>();
  for (const c of communications) {
    const arr = byCustomer.get(c.customer_id) ?? [];
    arr.push(c);
    byCustomer.set(c.customer_id, arr);
  }
  let groups: Group[] = [...byCustomer.entries()].map(([customerId, messages]) => {
    const inbound = messages.filter((m) => m.direction === "INBOUND" && m.classification);
    const withNext = messages.filter((m) => m.next_action_at || m.next_action_note);
    return {
      customerId,
      messages,
      last: messages[messages.length - 1],
      latestInbound: inbound[inbound.length - 1],
      nextAction: withNext[withNext.length - 1],
      pending: messages.filter((m) => m.direction === "OUTBOUND" && m.status === "PENDING_APPROVAL").length,
    };
  });
  groups.sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
  if (onlyPending) groups = groups.filter((g) => g.pending > 0);

  // A ?reply= link may point at a customer outside the current filter; honour it.
  const requestedCustomer = first(sp.customer) ?? (replyId ? communications.find((c) => c.id === replyId)?.customer_id : undefined);
  const selected = groups.find((g) => g.customerId === requestedCustomer) ?? (requestedCustomer && byCustomer.has(requestedCustomer) ? { customerId: requestedCustomer, messages: byCustomer.get(requestedCustomer)! } : undefined) ?? groups[0];
  const selectedCustomer = selected ? custBy.get(selected.customerId) : undefined;
  const threadInvoices: ThreadInvoiceOption[] = selected
    ? invoices
        .filter((i) => i.customer_id === selected.customerId && isOpen(i))
        .map((i) => ({ id: i.id, label: `${i.invoice_number} · ${formatMoney(outstanding(i), i.currency, locale)}` }))
    : [];
  const threadMessages = selected ? selected.messages.map((m) => ({ ...m, invoiceNumber: m.invoice_id ? (invBy.get(m.invoice_id)?.invoice_number ?? null) : null })) : [];

  const listHref = (customerId: string) => `/communications?customer=${customerId}${onlyPending ? "&status=PENDING_APPROVAL" : ""}`;

  return (
    <>
      <PageHeader
        title={t.communications.title}
        subtitle={t.communications.subtitle}
        actions={
          <>
            <div className="inline-flex items-center gap-1 rounded-md border bg-background p-0.5 text-xs">
              <Link href="/communications" className={cn("rounded px-2.5 py-1 font-medium transition-colors", !onlyPending ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {t.common.all}
              </Link>
              <Link href="/communications?status=PENDING_APPROVAL" className={cn("rounded px-2.5 py-1 font-medium transition-colors", onlyPending ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {t.communications.pendingApproval}
              </Link>
            </div>
            <RunCycleButton t={t} variant="outline" />
          </>
        }
      />

      {communications.length === 0 ? (
        <EmptyState title={t.communications.noMessages} action={<RunCycleButton t={t} />} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Card className="self-start">
            <CardHeader>
              <CardTitle>{L.customers}</CardTitle>
              <CardDescription>{groups.length}</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {groups.length === 0 && <p className="px-5 pb-5 text-sm text-muted-foreground">{L.noPending}</p>}
              <ul className="flex flex-col divide-y">
                {groups.map((g) => {
                  const customer = custBy.get(g.customerId);
                  const active = selected?.customerId === g.customerId;
                  const lastInv = g.last.invoice_id ? invBy.get(g.last.invoice_id) : undefined;
                  const intent = g.latestInbound?.classification?.intent;
                  const ChannelIcon = g.last.channel === "WHATSAPP" ? MessageCircle : Mail;
                  return (
                    <li key={g.customerId}>
                      <Link href={listHref(g.customerId)} className={cn("block px-5 py-3 transition-colors hover:bg-accent/50", active && "bg-accent/70")} aria-current={active ? "true" : undefined}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-medium">{customer?.company_name ?? "—"}</p>
                          {g.pending > 0 && (
                            <Badge variant="warning" className="shrink-0">
                              {g.pending} {t.communications.pendingApproval.toLocaleLowerCase(locale)}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <ChannelIcon className="size-3 shrink-0" />
                          {lastInv && <span className="font-mono">{lastInv.invoice_number}</span>}
                          <span className="ml-auto tabular">{formatDateTime(g.last.sent_at ?? g.last.created_at, locale)}</span>
                        </div>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{g.last.subject ? `${g.last.subject} — ` : ""}{g.last.body}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {intent && <Badge variant="violet">{t.intent[intent]}</Badge>}
                          {g.nextAction && (g.nextAction.next_action_note || g.nextAction.next_action_at) && (
                            <span className="text-[11px] text-muted-foreground">
                              {t.communications.nextAction}: {g.nextAction.next_action_note ?? ""}
                              {g.nextAction.next_action_at ? ` · ${formatDate(g.nextAction.next_action_at, locale)}` : ""}
                            </span>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {selected && selectedCustomer ? (
            <Thread customer={{ id: selectedCustomer.id, name: selectedCustomer.company_name }} messages={threadMessages} invoices={threadInvoices} highlightId={replyId} t={t} locale={locale} />
          ) : (
            <EmptyState title={onlyPending ? L.noPending : t.communications.noMessages} />
          )}
        </div>
      )}
    </>
  );
}
