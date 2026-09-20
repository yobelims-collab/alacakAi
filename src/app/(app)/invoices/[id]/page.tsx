import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DescriptionList, PageHeader } from "@/components/app/page-header";
import { InvoiceStatusBadge, PaymentStatusBadge, PromiseStatusBadge, StageBadge } from "@/components/app/status-badge";
import { CommunicationList } from "@/components/customers/communication-list";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireContext } from "@/lib/db";
import { formatDate, formatDateTime, today } from "@/lib/domain/dates";
import { toInvoiceView } from "@/lib/domain/invoices";
import { formatMoney } from "@/lib/domain/money";

export const metadata = { title: "Invoice" };

const LABELS = {
  tr: { promisedDate: "Söz verilen tarih", noPromises: "Bu fatura için ödeme sözü yok.", noPayments: "Eşleşen ödeme yok.", noComms: "Bu faturaya ait mesaj yok.", created: "Oluşturulma", lastReminder: "Son hatırlatma", dueIn: "gün kaldı" },
  en: { promisedDate: "Promised date", noPromises: "No payment promises for this invoice.", noPayments: "No matched payments.", noComms: "No messages on this invoice.", created: "Created", lastReminder: "Last reminder", dueIn: "days left" },
};

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const { t, locale, org } = ctx;
  const L = LABELS[locale];
  const raw = await ctx.store.get("invoices", id);
  if (!raw) notFound();
  const asOf = today();
  const inv = toInvoiceView(raw, asOf);
  const [customer, communications, promises, payments] = await Promise.all([
    ctx.store.get("customers", inv.customer_id),
    ctx.store.list("communications", { where: { invoice_id: id } }),
    ctx.store.list("payment_promises", { where: { invoice_id: id } }),
    ctx.store.list("payments", { where: { matched_invoice_id: id }, orderBy: "payment_date", ascending: false }),
  ]);
  const money = (n: number) => formatMoney(n, inv.currency, locale);
  const daysToDue = inv.days_overdue > 0 ? 0 : Math.max(0, Math.round((new Date(`${inv.due_date}T00:00:00Z`).getTime() - new Date(`${asOf}T00:00:00Z`).getTime()) / 86_400_000));

  return (
    <>
      <PageHeader
        title={inv.invoice_number}
        subtitle={customer ? [customer.company_name, customer.contact_person, customer.email].filter(Boolean).join(" · ") : undefined}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/invoices">
              <ArrowLeft /> {t.common.back}
            </Link>
          </Button>
        }
      />

      <div className="-mt-3 mb-4 flex flex-wrap items-center gap-2">
        {customer && (
          <Link href={`/customers/${customer.id}`} className="text-xs font-medium hover:underline">
            {t.common.customer}: {customer.company_name}
          </Link>
        )}
        <InvoiceStatusBadge status={inv.effective_status} t={t} />
        <StageBadge stage={inv.collection_stage} t={t} />
        {inv.days_overdue > 0 ? (
          <span className={`text-xs font-medium tabular ${inv.days_overdue > 30 ? "text-red-700 dark:text-red-300" : inv.days_overdue > 7 ? "text-orange-700 dark:text-orange-300" : "text-amber-700 dark:text-amber-300"}`}>
            {inv.days_overdue} {t.common.daysOverdue}
          </span>
        ) : inv.outstanding > 0 && inv.effective_status !== "DRAFT" ? (
          <span className="text-xs text-muted-foreground tabular">
            {daysToDue} {L.dueIn}
          </span>
        ) : null}
      </div>

      <div className="mb-4">
        <InvoiceActions t={t} locale={locale} invoiceId={inv.id} customerId={inv.customer_id} status={inv.effective_status} daysOverdue={inv.days_overdue} collectionStage={inv.collection_stage} defaultTone={org.ai_default_tone} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t.common.details}</CardTitle>
            <CardDescription>{inv.currency}</CardDescription>
          </CardHeader>
          <CardContent>
            <DescriptionList
              items={[
                { label: t.invoices.invoiceDate, value: formatDate(inv.invoice_date, locale) },
                { label: t.invoices.dueDate, value: formatDate(inv.due_date, locale) },
                { label: t.common.amount, value: money(inv.amount) },
                { label: t.invoices.paid, value: money(inv.paid_amount) },
                { label: t.invoices.outstanding, value: <span className={`font-semibold ${inv.outstanding > 0 && inv.days_overdue > 0 ? "text-red-700 dark:text-red-300" : ""}`}>{money(inv.outstanding)}</span> },
                { label: t.common.currency, value: inv.currency },
                { label: t.invoices.assigned, value: inv.assigned_user_id === ctx.user.id ? ctx.user.full_name : "—" },
                { label: L.lastReminder, value: inv.last_reminder_at ? `${formatDateTime(inv.last_reminder_at, locale)}${inv.last_reminder_stage ? ` · ${t.stage[inv.last_reminder_stage]}` : ""}` : "—" },
                { label: L.created, value: formatDateTime(inv.created_at, locale) },
                { label: t.invoices.description, value: inv.description ?? "—" },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.invoices.payments}</CardTitle>
            <CardDescription>{payments.length}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {payments.length === 0 && <p className="text-sm text-muted-foreground">{L.noPayments}</p>}
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium tabular text-emerald-700 dark:text-emerald-300">+{formatMoney(p.amount, p.currency, locale)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(p.payment_date, locale)}
                    {p.reference && <span className="ml-1 font-mono">· {p.reference}</span>}
                  </p>
                </div>
                <PaymentStatusBadge status={p.status} t={t} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>{t.invoices.communications}</CardTitle>
              <CardDescription>{communications.length}</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/communications?customer=${inv.customer_id}`}>{t.nav.communications}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <CommunicationList items={communications} t={t} locale={locale} emptyText={L.noComms} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.invoices.promises}</CardTitle>
            <CardDescription>{promises.length}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">{L.promisedDate}</TableHead>
                  <TableHead className="text-right">{t.common.amount}</TableHead>
                  <TableHead className="pr-5">{t.common.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...promises]
                  .sort((a, b) => (a.promised_date < b.promised_date ? 1 : -1))
                  .map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-5">{formatDate(p.promised_date, locale)}</TableCell>
                      <TableCell className="text-right tabular">{p.amount != null ? formatMoney(p.amount, p.currency, locale) : "—"}</TableCell>
                      <TableCell className="pr-5">
                        <PromiseStatusBadge status={p.status} t={t} />
                      </TableCell>
                    </TableRow>
                  ))}
                {promises.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                      {L.noPromises}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
