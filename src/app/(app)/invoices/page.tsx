import Link from "next/link";
import { Plus, Search, Upload } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { InvoiceStatusBadge, StageBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireContext } from "@/lib/db";
import { formatDate, today } from "@/lib/domain/dates";
import { toInvoiceView } from "@/lib/domain/invoices";
import { formatMoney } from "@/lib/domain/money";
import { INVOICE_STATUSES, type Currency, type InvoiceStatus } from "@/lib/types";

export const metadata = { title: "Invoices" };

const LABELS = {
  tr: { count: "fatura", filter: "Filtrele", noResults: "Filtreyle eşleşen fatura yok." },
  en: { count: "invoices", filter: "Filter", noResults: "No invoices match the filter." },
};

function isStatus(v: string | undefined): v is InvoiceStatus {
  return !!v && (INVOICE_STATUSES as readonly string[]).includes(v);
}

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string; filter?: string; q?: string }> }) {
  const ctx = await requireContext();
  const { t, locale } = ctx;
  const L = LABELS[locale];
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = isStatus(sp.status) ? sp.status : undefined;
  const overdueOnly = sp.filter === "overdue";
  const asOf = today();

  const [invoices, customers] = await Promise.all([ctx.store.list("invoices"), ctx.store.list("customers")]);
  const custBy = new Map(customers.map((c) => [c.id, c]));
  const needle = q.toLocaleLowerCase("tr");
  const rows = invoices
    .map((inv) => ({ ...toInvoiceView(inv, asOf), customer: custBy.get(inv.customer_id) ?? null }))
    .filter((v) => (status ? v.effective_status === status : true))
    .filter((v) => (overdueOnly ? v.days_overdue > 0 && v.outstanding > 0 : true))
    .filter((v) => (needle ? v.invoice_number.toLocaleLowerCase("tr").includes(needle) || (v.customer?.company_name ?? "").toLocaleLowerCase("tr").includes(needle) : true))
    .sort((a, b) => {
      const ga = a.effective_status === "PAID" ? 1 : 0;
      const gb = b.effective_status === "PAID" ? 1 : 0;
      if (ga !== gb) return ga - gb;
      return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
    });

  const totals = new Map<Currency, number>();
  for (const r of rows) totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.outstanding);
  const summary = [...totals.entries()].map(([cur, amt]) => formatMoney(amt, cur, locale)).join(" · ");
  const hasFilter = Boolean(status || overdueOnly || q);

  return (
    <>
      <PageHeader
        title={t.invoices.title}
        subtitle={t.invoices.subtitle}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/invoices/import">
                <Upload /> {t.invoices.importCsv}
              </Link>
            </Button>
            <Button asChild variant="brand" size="sm">
              <Link href="/invoices/new">
                <Plus /> {t.invoices.new}
              </Link>
            </Button>
          </>
        }
      />

      {invoices.length === 0 ? (
        <EmptyState
          title={t.invoices.noInvoices}
          description={t.invoices.csvHint}
          action={
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/invoices/import">{t.invoices.importCsv}</Link>
              </Button>
              <Button asChild variant="brand" size="sm">
                <Link href="/invoices/new">{t.invoices.new}</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <Card>
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
            <form method="get" className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input name="q" defaultValue={q} placeholder={`${t.common.search}…`} className="w-56 pl-8" aria-label={t.common.search} />
              </div>
              <Select name="status" defaultValue={status ?? ""} className="w-44" aria-label={t.invoices.filterStatus}>
                <option value="">{t.invoices.filterStatus}: {t.common.all}</option>
                {INVOICE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t.status[s]}
                  </option>
                ))}
              </Select>
              <label className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs">
                <input type="checkbox" name="filter" value="overdue" defaultChecked={overdueOnly} className="size-3.5 accent-red-600" />
                {t.invoices.filterOverdueOnly}
              </label>
              <Button type="submit" variant="outline" size="sm">
                {L.filter}
              </Button>
              {hasFilter && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/invoices">{t.common.all}</Link>
                </Button>
              )}
            </form>
            <p className="text-xs text-muted-foreground tabular">
              {rows.length} {L.count}
              {summary && (
                <>
                  {" · "}
                  {t.invoices.outstanding}: <span className="font-medium text-foreground">{summary}</span>
                </>
              )}
            </p>
          </div>
          <CardContent className="px-0 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">{t.invoices.number}</TableHead>
                  <TableHead>{t.common.customer}</TableHead>
                  <TableHead>{t.invoices.invoiceDate}</TableHead>
                  <TableHead>{t.invoices.dueDate}</TableHead>
                  <TableHead className="text-right">{t.common.amount}</TableHead>
                  <TableHead className="text-right">{t.invoices.paid}</TableHead>
                  <TableHead className="text-right">{t.invoices.outstanding}</TableHead>
                  <TableHead>{t.invoices.daysOverdue}</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                  <TableHead>{t.invoices.stage}</TableHead>
                  <TableHead className="pr-5">{t.invoices.assigned}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((inv) => (
                  <TableRow key={inv.id} className={inv.effective_status === "PAID" ? "text-muted-foreground" : ""}>
                    <TableCell className="pl-5">
                      <Link href={`/invoices/${inv.id}`} className="whitespace-nowrap font-mono text-xs font-medium text-foreground hover:underline">
                        {inv.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      {inv.customer ? (
                        <Link href={`/customers/${inv.customer.id}`} className="hover:underline">
                          {inv.customer.company_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(inv.invoice_date, locale)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(inv.due_date, locale)}</TableCell>
                    <TableCell className="text-right tabular">{formatMoney(inv.amount, inv.currency, locale)}</TableCell>
                    <TableCell className="text-right tabular text-muted-foreground">{formatMoney(inv.paid_amount, inv.currency, locale)}</TableCell>
                    <TableCell className="text-right tabular font-medium">{formatMoney(inv.outstanding, inv.currency, locale)}</TableCell>
                    <TableCell className="tabular">
                      {inv.days_overdue > 0 ? (
                        <span className={inv.days_overdue > 30 ? "font-semibold text-red-700" : inv.days_overdue > 7 ? "text-orange-700" : ""}>
                          {inv.days_overdue} {t.common.days}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={inv.effective_status} t={t} />
                    </TableCell>
                    <TableCell>
                      <StageBadge stage={inv.collection_stage} t={t} />
                    </TableCell>
                    <TableCell className="pr-5 text-muted-foreground">{inv.assigned_user_id === ctx.user.id ? ctx.user.full_name : "—"}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                      {L.noResults}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
