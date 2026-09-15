import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AttentionList } from "@/components/app/attention-list";
import { PageHeader, StatCard } from "@/components/app/page-header";
import { RunCycleButton } from "@/components/app/run-cycle-button";
import { InvoiceStatusBadge, RiskBadge, SeverityIcon } from "@/components/app/status-badge";
import { AgingChart, CollectedVsOutstandingChart, ReceivablesChart } from "@/components/charts/dashboard-charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireContext } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { loadDashboard } from "@/lib/queries";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await requireContext();
  const { t, locale, org } = ctx;
  const data = await loadDashboard(ctx);
  const m = data.metrics;
  const rc = org.reporting_currency;
  const money = (n: number) => formatMoney(n, rc, locale, { compact: true });

  return (
    <>
      <PageHeader title={t.dashboard.title} subtitle={`${t.dashboard.subtitle} · ${t.dashboard.reportingIn}: ${rc}`} actions={<RunCycleButton t={t} />} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label={t.dashboard.totalReceivables} value={money(m.totalReceivables)} hint={`${m.openCount} ${t.dashboard.openInvoices}`} />
        <StatCard label={t.dashboard.overdue} value={money(m.overdue)} hint={`${m.overdueCount} ${t.dashboard.overdueCount}`} tone={m.overdue > 0 ? "critical" : "default"} />
        <StatCard label={t.dashboard.dueThisWeek} value={money(m.dueThisWeek)} tone="warning" />
        <StatCard label={t.dashboard.collectedThisMonth} value={money(m.collectedThisMonth)} tone="success" />
        <StatCard label={t.dashboard.collectionRate} value={`${m.collectionRate.toLocaleString(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: 1 })}%`} hint={t.dashboard.last90} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t.dashboard.receivablesOverTime}</CardTitle>
            <CardDescription>{rc}</CardDescription>
          </CardHeader>
          <CardContent>
            <ReceivablesChart data={m.receivablesSeries} locale={locale} currency={rc} labels={{ outstanding: t.customers.outstanding, overdue: t.dashboard.overdue }} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.agingBuckets}</CardTitle>
            <CardDescription>{t.dashboard.overdue} · {rc}</CardDescription>
          </CardHeader>
          <CardContent>
            <AgingChart data={m.aging} locale={locale} currency={rc} unit={t.common.days} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>{t.dashboard.overdueInvoices}</CardTitle>
              <CardDescription>{data.overdue.length} {t.dashboard.overdueCount}</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/invoices?filter=overdue">
                {t.dashboard.seeAllOverdue} <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">{t.common.customer}</TableHead>
                  <TableHead>{t.common.invoice}</TableHead>
                  <TableHead className="text-right">{t.common.amount}</TableHead>
                  <TableHead>{t.invoices.dueDate}</TableHead>
                  <TableHead>{t.invoices.daysOverdue}</TableHead>
                  <TableHead>{t.customers.risk}</TableHead>
                  <TableHead className="pr-5">{t.common.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.overdue.slice(0, 8).map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="pl-5 font-medium">
                      <Link href={`/customers/${inv.customer.id}`} className="hover:underline">{inv.customer.company_name}</Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/invoices/${inv.id}`} className="whitespace-nowrap font-mono text-xs hover:underline">{inv.invoice_number}</Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular font-medium">{formatMoney(inv.outstanding, inv.currency, locale)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(inv.due_date, locale)}</TableCell>
                    <TableCell className="whitespace-nowrap tabular">
                      <span className={inv.days_overdue > 30 ? "font-semibold text-red-700" : inv.days_overdue > 7 ? "text-orange-700" : ""}>{inv.days_overdue} {t.common.daysOverdue}</span>
                    </TableCell>
                    <TableCell>{inv.risk ? <RiskBadge level={inv.risk.level} t={t} /> : "—"}</TableCell>
                    <TableCell className="pr-5"><InvoiceStatusBadge status={inv.effective_status} t={t} /></TableCell>
                  </TableRow>
                ))}
                {data.overdue.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{t.common.noData}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.collectedVsOutstanding}</CardTitle>
            <CardDescription>{rc}</CardDescription>
          </CardHeader>
          <CardContent>
            <CollectedVsOutstandingChart data={m.collectedVsOutstanding} locale={locale} currency={rc} labels={{ collected: locale === "tr" ? "Tahsil edilen" : "Collected", outstanding: t.customers.outstanding }} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>{t.dashboard.humanAttention}</CardTitle>
              <CardDescription>{data.attention.length}</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/attention">{t.dashboard.viewAll} <ArrowRight /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <AttentionList items={data.attention.slice(0, 4)} t={t} locale={locale} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{t.dashboard.pendingApprovals}</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/communications?status=PENDING_APPROVAL">{t.dashboard.viewAll} <ArrowRight /></Link>
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {data.pendingApprovals.length === 0 && <p className="text-sm text-muted-foreground">{t.common.noData}</p>}
              {data.pendingApprovals.slice(0, 4).map((c) => (
                <Link key={c.id} href={`/communications?customer=${c.customer_id}&reply=${c.id}`} className="rounded-md border p-2.5 text-sm hover:bg-accent/50">
                  <p className="font-medium">{c.customer?.company_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.subject}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{t.dashboard.recentActions}</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/ai-actions">{t.dashboard.viewAll} <ArrowRight /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2.5">
                {data.recentActions.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-start gap-2 text-sm">
                    <SeverityIcon severity={a.severity} className="mt-0.5" />
                    <div className="min-w-0">
                      <p className="truncate">{a.title}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDateTime(a.created_at, locale)}</p>
                    </div>
                  </li>
                ))}
                {data.recentActions.length === 0 && <li className="text-sm text-muted-foreground">{t.aiActions.noActions}</li>}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
