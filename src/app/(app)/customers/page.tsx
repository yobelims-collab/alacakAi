import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { RiskBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireContext } from "@/lib/db";
import { formatDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { loadCustomers } from "@/lib/queries";

export const metadata = { title: "Customers" };

const LABELS = {
  tr: { countryLanguage: "Ülke / Dil", terms: "Vade", results: "müşteri", noResults: "Aramayla eşleşen müşteri yok." },
  en: { countryLanguage: "Country / Language", terms: "Terms", results: "customers", noResults: "No customers match your search." },
};

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireContext();
  const { t, locale } = ctx;
  const L = LABELS[locale];
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const all = await loadCustomers(ctx);
  const needle = q.toLocaleLowerCase("tr");
  const rows = needle
    ? all.filter(({ customer: c }) => [c.company_name, c.contact_person ?? "", c.email ?? ""].some((v) => v.toLocaleLowerCase("tr").includes(needle)))
    : all;

  return (
    <>
      <PageHeader
        title={t.customers.title}
        subtitle={t.customers.subtitle}
        actions={
          <Button asChild variant="brand" size="sm">
            <Link href="/customers/new">
              <Plus /> {t.customers.new}
            </Link>
          </Button>
        }
      />

      {all.length === 0 ? (
        <EmptyState
          title={t.customers.noCustomers}
          action={
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/invoices/import">{t.invoices.importCsv}</Link>
              </Button>
              <Button asChild variant="brand" size="sm">
                <Link href="/customers/new">{t.customers.new}</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <Card>
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <form method="get" className="flex w-full max-w-sm items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input name="q" defaultValue={q} placeholder={`${t.common.search}…`} className="pl-8" aria-label={t.common.search} />
              </div>
              <Button type="submit" variant="outline" size="sm">
                {t.common.search}
              </Button>
              {q && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/customers">{t.common.all}</Link>
                </Button>
              )}
            </form>
            <p className="text-xs text-muted-foreground tabular">
              {rows.length} {L.results}
            </p>
          </div>
          <CardContent className="px-0 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">{t.customers.companyName}</TableHead>
                  <TableHead>{t.customers.contactPerson}</TableHead>
                  <TableHead>{L.countryLanguage}</TableHead>
                  <TableHead className="text-right">{L.terms}</TableHead>
                  <TableHead className="text-right">{t.customers.outstanding}</TableHead>
                  <TableHead className="text-right">{t.customers.overdue}</TableHead>
                  <TableHead className="text-right">{t.customers.avgDelay}</TableHead>
                  <TableHead className="text-right">{t.customers.reliability}</TableHead>
                  <TableHead>{t.customers.risk}</TableHead>
                  <TableHead>{t.customers.lastPayment}</TableHead>
                  <TableHead className="pr-5">{t.customers.nextExpected}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ customer: c, financials: f, risk, reliability }) => (
                  <TableRow key={c.id}>
                    <TableCell className="pl-5 font-medium">
                      <Link href={`/customers/${c.id}`} className="hover:underline">
                        {c.company_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <p>{c.contact_person ?? "—"}</p>
                      {c.email && <p className="truncate text-xs">{c.email}</p>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.country ?? "—"} <span className="uppercase text-xs">· {c.preferred_language}</span>
                    </TableCell>
                    <TableCell className="text-right tabular text-muted-foreground">
                      {c.payment_terms_days} {t.common.days}
                    </TableCell>
                    <TableCell className="text-right tabular font-medium">{formatMoney(f.outstanding, f.currency, locale)}</TableCell>
                    <TableCell className={`text-right tabular ${f.overdue > 0 ? "font-medium text-red-700" : "text-muted-foreground"}`}>{formatMoney(f.overdue, f.currency, locale)}</TableCell>
                    <TableCell className="text-right tabular">
                      <span className={f.averageDelayDays > 30 ? "font-semibold text-red-700" : f.averageDelayDays > 7 ? "text-orange-700" : ""}>
                        {f.averageDelayDays} {t.common.days}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular">
                      <span className={reliability < 40 ? "font-semibold text-red-700" : reliability < 70 ? "text-orange-700" : "text-emerald-700"}>{reliability}</span>
                      <span className="text-muted-foreground">/100</span>
                    </TableCell>
                    <TableCell>{risk ? <RiskBadge level={risk.level} score={risk.score} t={t} /> : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(f.lastPaymentDate, locale)}</TableCell>
                    <TableCell className="pr-5 text-muted-foreground">{formatDate(f.nextExpectedPayment, locale)}</TableCell>
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
