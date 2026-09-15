import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Bot, Mail, MessageCircle } from "lucide-react";
import { CommStatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/domain/dates";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Communication, Locale } from "@/lib/types";

/**
 * Server-renderable list of communications, newest first. Used on the customer profile
 * and the invoice detail page; every item links to the communication center for that customer.
 */
export function CommunicationList({ items, t, locale, invoiceNumbers = {}, emptyText }: { items: Communication[]; t: Dictionary; locale: Locale; invoiceNumbers?: Record<string, string>; emptyText?: string }) {
  if (items.length === 0) return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{emptyText ?? t.communications.noMessages}</p>;
  const sorted = [...items].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((c) => {
        const inbound = c.direction === "INBOUND";
        const DirIcon = inbound ? ArrowDownLeft : ArrowUpRight;
        const ChannelIcon = c.channel === "WHATSAPP" ? MessageCircle : Mail;
        const invNo = c.invoice_id ? invoiceNumbers[c.invoice_id] : undefined;
        return (
          <li key={c.id}>
            <Link href={`/communications?customer=${c.customer_id}`} className="block rounded-lg border bg-card p-3.5 transition-colors hover:bg-accent/40">
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${inbound ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}>
                  <DirIcon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <ChannelIcon className="size-3.5" /> {t.channel[c.channel]}
                    </span>
                    <span className="text-xs text-muted-foreground">{inbound ? t.communications.inbound : t.communications.outbound}</span>
                    <CommStatusBadge status={c.status} t={t} />
                    {inbound && c.classification && <Badge variant="violet">{t.intent[c.classification.intent]}</Badge>}
                    {!inbound && c.ai_generated && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Bot className="size-3" /> AI
                      </span>
                    )}
                    {invNo && <span className="font-mono text-[11px] text-muted-foreground">{invNo}</span>}
                  </div>
                  {c.subject && <p className="mt-1 text-sm font-medium">{c.subject}</p>}
                  <p className="mt-0.5 line-clamp-2 text-sm text-foreground/80">{c.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(c.sent_at ?? c.created_at, locale)}</p>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
