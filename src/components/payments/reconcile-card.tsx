"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Check, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { matchPaymentAction, rejectSuggestionAction } from "@/lib/actions/payments";
import { formatDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Currency, Locale, Payment } from "@/lib/types";

export interface ReconcileSuggestion {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  confidence: number;
  reasons: string[];
}

export interface ReconcileInvoiceOption {
  id: string;
  currency: Currency;
  label: string;
}

const LOCAL = {
  tr: { incoming: "Gelen ödeme", matched: "Ödeme eşleştirildi", rejected: "Öneri reddedildi", noOpen: "Bu para biriminde açık fatura yok" },
  en: { incoming: "Incoming payment", matched: "Payment matched", rejected: "Suggestion rejected", noOpen: "No open invoices in this currency" },
};

export function ReconcileCard({ payment, customerName, sourceLabel, suggestion, options, t, locale }: { payment: Payment; customerName: string | null; sourceLabel: string; suggestion: ReconcileSuggestion | null; options: ReconcileInvoiceOption[]; t: Dictionary; locale: Locale }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [manual, setManual] = useState("");
  const L = LOCAL[locale];

  const match = (invoiceId: string) =>
    start(async () => {
      const r = await matchPaymentAction(payment.id, invoiceId);
      if (!r.ok) toast.error(r.error ?? "Error");
      else toast.success(L.matched);
      router.refresh();
    });
  const reject = () =>
    start(async () => {
      const r = await rejectSuggestionAction(payment.id);
      if (!r.ok) toast.error(r.error ?? "Error");
      else toast.success(L.rejected);
      router.refresh();
    });

  const pct = suggestion ? Math.round(suggestion.confidence * 100) : 0;
  const pctTone = pct >= 80 ? "success" : pct >= 50 ? "warning" : "neutral";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{L.incoming}</p>
            <p className="mt-1 text-lg font-semibold tabular tracking-tight">{formatMoney(payment.amount, payment.currency, locale)}</p>
            <dl className="mt-2 flex flex-col gap-1 text-xs">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-muted-foreground">{t.payments.paymentDate}</dt>
                <dd>{formatDate(payment.payment_date, locale)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-muted-foreground">{t.common.reference}</dt>
                <dd className="break-all">{payment.reference ?? "—"}</dd>
              </div>
              {customerName && (
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-muted-foreground">{t.common.customer}</dt>
                  <dd>{customerName}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-muted-foreground">{t.payments.source}</dt>
                <dd>{sourceLabel}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Sparkles className="size-3.5" /> {t.payments.suggestion}
            </p>
            {suggestion ? (
              <>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Link href={`/invoices/${suggestion.invoiceId}`} className="font-mono text-sm font-medium hover:underline">
                    {suggestion.invoiceNumber}
                  </Link>
                  <Badge variant={pctTone}>
                    {t.common.confidence} {pct}%
                  </Badge>
                </div>
                <p className="mt-0.5 text-sm">{suggestion.customerName}</p>
                {suggestion.reasons.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[11px] font-medium text-muted-foreground">{t.payments.whyMatch}</p>
                    <ul className="mt-0.5 flex flex-col gap-0.5 text-xs">
                      {suggestion.reasons.map((r) => (
                        <li key={r} className="flex items-start gap-1.5">
                          <ArrowRight className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="brand" disabled={pending} onClick={() => match(suggestion.invoiceId)}>
                    {pending ? <Loader2 className="animate-spin" /> : <Check />} {t.common.match}
                  </Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={reject}>
                    <X /> {t.common.reject}
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-1.5 text-sm text-muted-foreground">{t.payments.noSuggestion}</p>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center">
          <Select value={manual} onChange={(e) => setManual(e.target.value)} disabled={pending || options.length === 0} className="h-8 text-xs sm:flex-1" aria-label={t.payments.chooseInvoice}>
            <option value="">{options.length === 0 ? L.noOpen : `${t.payments.chooseInvoice}…`}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="secondary" disabled={pending || !manual} onClick={() => match(manual)}>
            {pending ? <Loader2 className="animate-spin" /> : <Check />} {t.common.match}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
