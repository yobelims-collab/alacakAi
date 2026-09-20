import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PaymentStatusBadge } from "@/components/app/status-badge";
import { ReconcileCard, type ReconcileInvoiceOption, type ReconcileSuggestion } from "@/components/payments/reconcile-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireContext } from "@/lib/db";
import { formatDate } from "@/lib/domain/dates";
import { isOpen, outstanding } from "@/lib/domain/invoices";
import { formatMoney } from "@/lib/domain/money";
import { candidatesForPayment } from "@/lib/services/payment-service";
import { PAYMENT_STATUSES, type Payment, type PaymentStatus } from "@/lib/types";

export const metadata = { title: "Payments" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const SOURCE_LABEL: Record<"tr" | "en", Record<Payment["source"], string>> = {
  tr: { MANUAL: "Manuel", BANK_IMPORT: "Banka CSV", DEMO: "Demo" },
  en: { MANUAL: "Manual", BANK_IMPORT: "Bank CSV", DEMO: "Demo" },
};

const LOCAL = {
  tr: { filter: "Filtrele", unmatchedCount: "eşleşmemiş ödeme", description: "Açıklama" },
  en: { filter: "Apply", unmatchedCount: "unmatched payments", description: "Description" },
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const { t, locale } = ctx;
  const L = LOCAL[locale];
  const rawStatus = first(sp.status);
  const statusFilter = PAYMENT_STATUSES.includes(rawStatus as PaymentStatus) ? (rawStatus as PaymentStatus) : undefined;

  const [payments, invoices, customers, bankTx] = await Promise.all([
    ctx.store.list("payments", { orderBy: "payment_date" }),
    ctx.store.list("invoices"),
    ctx.store.list("customers"),
    ctx.store.list("bank_transactions", { orderBy: "transaction_date" }),
  ]);
  const custBy = new Map(customers.map((c) => [c.id, c]));
  const invBy = new Map(invoices.map((i) => [i.id, i]));
  const customerName = (id: string | null | undefined) => (id ? (custBy.get(id)?.company_name ?? "—") : "—");

  const openInvoices: ReconcileInvoiceOption[] = invoices
    .filter(isOpen)
    .map((inv) => ({ id: inv.id, currency: inv.currency, label: `${inv.invoice_number} · ${customerName(inv.customer_id)} · ${formatMoney(outstanding(inv), inv.currency, locale)}` }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));

  const unmatched = payments.filter((p) => p.status === "UNMATCHED");
  const reconcile = await Promise.all(
    unmatched.map(async (payment) => {
      const candidates = await candidatesForPayment(ctx, payment);
      const suggestedInv = payment.suggested_invoice_id ? invBy.get(payment.suggested_invoice_id) : undefined;
      const suggestion: ReconcileSuggestion | null = suggestedInv
        ? {
            invoiceId: suggestedInv.id,
            invoiceNumber: suggestedInv.invoice_number,
            customerName: customerName(suggestedInv.customer_id),
            confidence: payment.suggested_confidence ?? 0,
            reasons: payment.suggestion_reasons ?? [],
          }
        : null;
      const candidateIds = new Set(candidates.map((c) => c.invoice.id));
      const options: ReconcileInvoiceOption[] = [
        ...candidates.map((c) => ({ id: c.invoice.id, currency: c.invoice.currency, label: `${c.invoice.invoice_number} · ${customerName(c.invoice.customer_id)} · ${formatMoney(outstanding(c.invoice), c.invoice.currency, locale)} · ${Math.round(c.confidence * 100)}%` })),
        ...openInvoices.filter((o) => o.currency === payment.currency && !candidateIds.has(o.id)),
      ];
      return { payment, suggestion, options };
    }),
  );

  const filtered = statusFilter ? payments.filter((p) => p.status === statusFilter) : payments;

  return (
    <>
      <PageHeader
        title={t.payments.title}
        subtitle={t.payments.subtitle}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/payments/import">
                <Upload /> {t.payments.importBank}
              </Link>
            </Button>
            <Button asChild variant="brand" size="sm">
              <Link href="/payments/new">
                <Plus /> {t.payments.new}
              </Link>
            </Button>
          </>
        }
      />

      <section className="mb-6">
        <div className="mb-3">
          <h2 className="text-sm font-semibold tracking-tight">{t.payments.reconciliation}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.payments.reconciliationHint}</p>
        </div>
        {reconcile.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t.payments.allMatched}</p>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {reconcile.map(({ payment, suggestion, options }) => (
              <ReconcileCard key={payment.id} payment={payment} customerName={payment.customer_id ? customerName(payment.customer_id) : null} sourceLabel={SOURCE_LABEL[locale][payment.source]} suggestion={suggestion} options={options} t={t} locale={locale} />
            ))}
          </div>
        )}
      </section>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{t.payments.title}</CardTitle>
            <CardDescription>
              {filtered.length} · {unmatched.length} {L.unmatchedCount}
            </CardDescription>
          </div>
          <form method="get" className="flex items-center gap-2">
            <Select name="status" defaultValue={statusFilter ?? ""} className="h-8 w-44 text-xs" aria-label={t.common.status}>
              <option value="">{t.common.all}</option>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.status[s]}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="outline" size="sm">
              {L.filter}
            </Button>
          </form>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">{t.payments.paymentDate}</TableHead>
                <TableHead>{t.common.customer}</TableHead>
                <TableHead className="text-right">{t.common.amount}</TableHead>
                <TableHead>{t.common.currency}</TableHead>
                <TableHead>{t.common.reference}</TableHead>
                <TableHead>{t.payments.matchedInvoice}</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead className="pr-5">{t.payments.source}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const inv = p.matched_invoice_id ? invBy.get(p.matched_invoice_id) : undefined;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="pl-5 text-muted-foreground">{formatDate(p.payment_date, locale)}</TableCell>
                    <TableCell className="font-medium">
                      {p.customer_id ? (
                        <Link href={`/customers/${p.customer_id}`} className="hover:underline">
                          {customerName(p.customer_id)}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular font-medium">{formatMoney(p.amount, p.currency, locale)}</TableCell>
                    <TableCell className="text-muted-foreground">{p.currency}</TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground" title={p.reference ?? undefined}>
                      {p.reference ?? "—"}
                    </TableCell>
                    <TableCell>
                      {inv ? (
                        <Link href={`/invoices/${inv.id}`} className="font-mono text-xs hover:underline">
                          {inv.invoice_number}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={p.status} t={t} />
                    </TableCell>
                    <TableCell className="pr-5 text-muted-foreground">{SOURCE_LABEL[locale][p.source]}</TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    {t.common.noData}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t.payments.bankTransactions}</CardTitle>
          <CardDescription>{bankTx.length}</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">{t.common.date}</TableHead>
                <TableHead>{L.description}</TableHead>
                <TableHead>{t.common.reference}</TableHead>
                <TableHead className="text-right">{t.common.amount}</TableHead>
                <TableHead>{t.common.currency}</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead className="pr-5">{t.payments.matchedInvoice}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bankTx.map((tx) => {
                const inv = tx.matched_invoice_id ? invBy.get(tx.matched_invoice_id) : undefined;
                return (
                  <TableRow key={tx.id}>
                    <TableCell className="pl-5 text-muted-foreground">{formatDate(tx.transaction_date, locale)}</TableCell>
                    <TableCell className="max-w-64 truncate" title={tx.description ?? undefined}>
                      {tx.description ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-muted-foreground" title={tx.reference ?? undefined}>
                      {tx.reference ?? "—"}
                    </TableCell>
                    <TableCell className={`text-right tabular font-medium ${tx.amount < 0 ? "text-red-700 dark:text-red-300" : ""}`}>{formatMoney(tx.amount, tx.currency, locale)}</TableCell>
                    <TableCell className="text-muted-foreground">{tx.currency}</TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={tx.status} t={t} />
                    </TableCell>
                    <TableCell className="pr-5">
                      {inv ? (
                        <Link href={`/invoices/${inv.id}`} className="font-mono text-xs hover:underline">
                          {inv.invoice_number}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {bankTx.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    {t.common.noData}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
