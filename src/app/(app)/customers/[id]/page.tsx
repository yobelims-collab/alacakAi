import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, Languages, Lightbulb, Pencil } from "lucide-react";
import { DescriptionList, PageHeader } from "@/components/app/page-header";
import { InvoiceStatusBadge, PaymentStatusBadge, PromiseStatusBadge, RiskBadge } from "@/components/app/status-badge";
import { CommunicationList } from "@/components/customers/communication-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireContext } from "@/lib/db";
import { formatDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { loadCustomerDetail } from "@/lib/queries";

export const metadata = { title: "Customer" };

const LABELS = {
  tr: { overview: "Genel Bakış", payment: "Ödeme", type: "Tür", promisedDate: "Söz verilen tarih", noPromises: "Ödeme sözü yok.", noHistory: "Henüz fatura veya ödeme yok.", noInsights: "Henüz yeterli veri yok.", noRisk: "Risk skoru henüz hesaplanmadı.", usedOf: "kullanılan" },
  en: { overview: "Overview", payment: "Payment", type: "Type", promisedDate: "Promised date", noPromises: "No payment promises.", noHistory: "No invoices or payments yet.", noInsights: "Not enough data yet.", noRisk: "Risk score has not been computed yet.", usedOf: "used" },
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const { t, locale } = ctx;
  const L = LABELS[locale];
  const d = await loadCustomerDetail(ctx, id);
  if (!d) notFound();
  const { customer: c, financials: f, risk } = d;
  const money = (n: number) => formatMoney(n, f.currency, locale);
  const invoiceNumbers = Object.fromEntries(d.invoices.map((i) => [i.id, i.invoice_number]));

  type HistoryItem = { key: string; date: string; kind: "invoice"; inv: (typeof d.invoices)[number] } | { key: string; date: string; kind: "payment"; pay: (typeof d.payments)[number] };
  const history: HistoryItem[] = [
    ...d.invoices.map((inv) => ({ key: `i-${inv.id}`, date: inv.invoice_date, kind: "invoice" as const, inv })),
    ...d.payments.map((pay) => ({ key: `p-${pay.id}`, date: pay.payment_date, kind: "payment" as const, pay })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const promises = [...d.promises].sort((a, b) => (a.promised_date < b.promised_date ? 1 : -1));

  return (
    <>
      <PageHeader
        title={c.company_name}
        subtitle={[c.contact_person, c.email, c.phone].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/customers">
                <ArrowLeft /> {t.common.back}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/customers/${c.id}/edit`}>
                <Pencil /> {t.common.edit}
              </Link>
            </Button>
          </>
        }
      />

      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-2">
        {risk ? <RiskBadge level={risk.level} score={risk.score} t={t} /> : <Badge variant="neutral">{t.customers.risk}: —</Badge>}
        <Badge variant="neutral">
          <Languages /> {c.preferred_language === "tr" ? t.common.turkish : t.common.english}
        </Badge>
        {c.country && (
          <Badge variant="neutral">
            <Globe /> {c.country}
          </Badge>
        )}
        <Badge variant="neutral">{c.currency}</Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{L.overview}</TabsTrigger>
          <TabsTrigger value="history">{t.customers.paymentHistory}</TabsTrigger>
          <TabsTrigger value="promises">{t.customers.promises}</TabsTrigger>
          <TabsTrigger value="communication">{t.customers.communicationHistory}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t.customers.financialOverview}</CardTitle>
                <CardDescription>{f.currency}</CardDescription>
              </CardHeader>
              <CardContent>
                <DescriptionList
                  items={[
                    { label: t.customers.totalInvoiced, value: money(f.totalInvoiced) },
                    { label: t.customers.totalPaid, value: money(f.totalPaid) },
                    { label: t.customers.outstanding, value: <span className="font-semibold">{money(f.outstanding)}</span> },
                    { label: t.customers.overdue, value: <span className={f.overdue > 0 ? "font-semibold text-red-700" : ""}>{money(f.overdue)}</span> },
                    { label: t.customers.avgDelay, value: `${f.averageDelayDays} ${t.common.days}` },
                    { label: t.customers.overdueInvoices, value: f.overdueCount },
                    { label: t.customers.creditLimit, value: c.credit_limit ? `${money(c.credit_limit)} · ${Math.round((f.outstanding / c.credit_limit) * 100)}% ${L.usedOf}` : "—" },
                    { label: t.customers.activePromises, value: f.activePromises },
                    { label: t.customers.brokenPromises, value: <span className={f.brokenPromises90d > 0 ? "text-red-700" : ""}>{f.brokenPromises90d}</span> },
                    { label: t.customers.lastPayment, value: formatDate(f.lastPaymentDate, locale) },
                    { label: t.customers.nextExpected, value: formatDate(f.nextExpectedPayment, locale) },
                    { label: t.customers.paymentTerms, value: `${c.payment_terms_days} ${t.common.days}` },
                  ]}
                />
                {c.notes && (
                  <div className="mt-5 border-t pt-4">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.customers.notes}</p>
                    <p className="mt-1 whitespace-pre-line text-sm">{c.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.customers.aiInsights}</CardTitle>
                <CardDescription>{t.customers.riskScore}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {risk ? (
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-end justify-between gap-2">
                      <p className="text-3xl font-semibold tabular tracking-tight">
                        {risk.score}
                        <span className="text-base font-normal text-muted-foreground">/100</span>
                      </p>
                      <RiskBadge level={risk.level} t={t} />
                    </div>
                    {risk.reasons.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.customers.riskReasons}</p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
                          {risk.reasons.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="mt-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.customers.riskRecommendation}</p>
                      <p className="mt-1 text-sm">{risk.recommendation}</p>
                    </div>
                    <p className="mt-3 text-[11px] text-muted-foreground">{formatDate(risk.computed_at, locale)}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{L.noRisk}</p>
                )}
                <ul className="flex flex-col gap-2">
                  {d.insights.map((s) => (
                    <li key={s} className="flex items-start gap-2 text-sm">
                      <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600" />
                      <span>{s}</span>
                    </li>
                  ))}
                  {d.insights.length === 0 && <li className="text-sm text-muted-foreground">{L.noInsights}</li>}
                </ul>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{t.customers.riskDisclaimer}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>{t.customers.paymentHistory}</CardTitle>
              <CardDescription>
                {d.invoices.length} {t.nav.invoices.toLowerCase()} · {d.payments.length} {t.nav.payments.toLowerCase()}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">{t.common.date}</TableHead>
                    <TableHead>{L.type}</TableHead>
                    <TableHead>{t.common.reference}</TableHead>
                    <TableHead>{t.common.status}</TableHead>
                    <TableHead>{t.invoices.dueDate}</TableHead>
                    <TableHead className="text-right">{t.common.amount}</TableHead>
                    <TableHead className="pr-5 text-right">{t.invoices.outstanding}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h) =>
                    h.kind === "invoice" ? (
                      <TableRow key={h.key}>
                        <TableCell className="pl-5 text-muted-foreground">{formatDate(h.inv.invoice_date, locale)}</TableCell>
                        <TableCell>{t.common.invoice}</TableCell>
                        <TableCell>
                          <Link href={`/invoices/${h.inv.id}`} className="font-mono text-xs hover:underline">
                            {h.inv.invoice_number}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <InvoiceStatusBadge status={h.inv.effective_status} t={t} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(h.inv.due_date, locale)}
                          {h.inv.days_overdue > 0 && <span className="ml-1 text-xs text-red-700">+{h.inv.days_overdue}</span>}
                        </TableCell>
                        <TableCell className="text-right tabular">{formatMoney(h.inv.amount, h.inv.currency, locale)}</TableCell>
                        <TableCell className="pr-5 text-right tabular font-medium">{formatMoney(h.inv.outstanding, h.inv.currency, locale)}</TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={h.key} className="bg-emerald-50/30">
                        <TableCell className="pl-5 text-muted-foreground">{formatDate(h.pay.payment_date, locale)}</TableCell>
                        <TableCell>{L.payment}</TableCell>
                        <TableCell>
                          <span className="font-mono text-xs">{h.pay.reference ?? "—"}</span>
                          {h.pay.matched_invoice_id && invoiceNumbers[h.pay.matched_invoice_id] && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              → <Link href={`/invoices/${h.pay.matched_invoice_id}`} className="font-mono hover:underline">{invoiceNumbers[h.pay.matched_invoice_id]}</Link>
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <PaymentStatusBadge status={h.pay.status} t={t} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">—</TableCell>
                        <TableCell className="text-right tabular font-medium text-emerald-700">+{formatMoney(h.pay.amount, h.pay.currency, locale)}</TableCell>
                        <TableCell className="pr-5 text-right text-muted-foreground">—</TableCell>
                      </TableRow>
                    ),
                  )}
                  {history.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        {L.noHistory}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="promises">
          <Card>
            <CardHeader>
              <CardTitle>{t.customers.promises}</CardTitle>
              <CardDescription>
                {t.customers.activePromises}: {f.activePromises} · {t.customers.brokenPromises}: {f.brokenPromises90d}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">{L.promisedDate}</TableHead>
                    <TableHead>{t.common.invoice}</TableHead>
                    <TableHead className="text-right">{t.common.amount}</TableHead>
                    <TableHead>{t.common.status}</TableHead>
                    <TableHead className="pr-5">{t.customers.notes}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promises.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-5">{formatDate(p.promised_date, locale)}</TableCell>
                      <TableCell>
                        <Link href={`/invoices/${p.invoice_id}`} className="font-mono text-xs hover:underline">
                          {invoiceNumbers[p.invoice_id] ?? p.invoice_id}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular">{p.amount != null ? formatMoney(p.amount, p.currency, locale) : "—"}</TableCell>
                      <TableCell>
                        <PromiseStatusBadge status={p.status} t={t} />
                      </TableCell>
                      <TableCell className="pr-5 max-w-xs truncate text-muted-foreground">{p.notes ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {promises.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        {L.noPromises}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communication">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>{t.customers.communicationHistory}</CardTitle>
                <CardDescription>{d.communications.length}</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/communications?customer=${c.id}`}>{t.nav.communications}</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <CommunicationList items={d.communications} t={t} locale={locale} invoiceNumbers={invoiceNumbers} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
