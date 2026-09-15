"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, ExternalLink, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resolveActionAction } from "@/lib/actions/collection";
import { formatDateTime } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { AiAction, Currency, Customer, Invoice, Locale } from "@/lib/types";
import { SeverityIcon } from "./status-badge";

export type AttentionItem = AiAction & { customer: Customer | null; invoice: Invoice | null };

export function AttentionList({ items, t, locale, compact = false }: { items: AttentionItem[]; t: Dictionary; locale: Locale; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (items.length === 0) return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t.dashboard.noAttention}</p>;
  const resolve = (id: string) =>
    start(async () => {
      const r = await resolveActionAction(id);
      if (!r.ok) toast.error(r.error ?? "Error");
      else toast.success(t.aiActions.markResolved);
      router.refresh();
    });
  return (
    <ul className="flex flex-col gap-2">
      {items.map((a) => {
        const payload = (a.payload ?? {}) as { outstanding?: number | null; currency?: string | null; invoice_number?: string | null };
        const amount = a.invoice ? formatMoney(a.invoice.amount - a.invoice.paid_amount, a.invoice.currency, locale) : payload.outstanding ? formatMoney(payload.outstanding, (payload.currency as Currency) ?? "TRY", locale) : null;
        return (
          <li key={a.id} className="rounded-lg border bg-card p-3.5">
            <div className="flex items-start gap-3">
              <SeverityIcon severity={a.severity} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="text-sm font-medium">{a.customer?.company_name ?? a.title}</p>
                  {amount && <span className="text-sm font-semibold tabular">{amount}</span>}
                  {a.invoice && <span className="font-mono text-[11px] text-muted-foreground">{a.invoice.invoice_number}</span>}
                </div>
                <p className="mt-0.5 text-sm text-foreground/90">{a.customer ? a.title.replace(`${a.customer.company_name}: `, "") : ""}{a.description ? ` — ${a.description}` : ""}</p>
                {a.recommended_action && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{t.aiActions.recommendedAction}:</span> {a.recommended_action}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(a.created_at, locale)}</p>
                {!compact && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {a.customer && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/customers/${a.customer.id}`}>
                          <ExternalLink /> {t.aiActions.viewCustomer}
                        </Link>
                      </Button>
                    )}
                    {a.communication_id && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/communications?customer=${a.customer_id ?? ""}&reply=${a.communication_id}`}>
                          <MessageSquare /> {t.aiActions.approveResponse}
                        </Link>
                      </Button>
                    )}
                    <Button variant="secondary" size="sm" disabled={pending} onClick={() => resolve(a.id)}>
                      {pending ? <Loader2 className="animate-spin" /> : <Check />} {t.aiActions.markResolved}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
