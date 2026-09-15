import { PageHeader } from "@/components/app/page-header";
import { PaymentForm } from "@/components/payments/payment-form";
import { Card, CardContent } from "@/components/ui/card";
import { requireContext } from "@/lib/db";
import { today } from "@/lib/domain/dates";
import { isOpen, outstanding } from "@/lib/domain/invoices";
import { formatMoney } from "@/lib/domain/money";

export const metadata = { title: "New payment" };

export default async function NewPaymentPage() {
  const ctx = await requireContext();
  const { t, locale, org } = ctx;
  const [customers, invoices] = await Promise.all([ctx.store.list("customers", { orderBy: "company_name", ascending: true }), ctx.store.list("invoices", { orderBy: "due_date", ascending: true })]);
  const custBy = new Map(customers.map((c) => [c.id, c]));
  const openInvoices = invoices.filter(isOpen).map((inv) => ({
    id: inv.id,
    customerId: inv.customer_id,
    currency: inv.currency,
    label: `${inv.invoice_number} · ${custBy.get(inv.customer_id)?.company_name ?? "—"} · ${formatMoney(outstanding(inv), inv.currency, locale)} · ${inv.currency}`,
  }));

  return (
    <>
      <PageHeader title={t.payments.new} subtitle={t.payments.subtitle} />
      <Card className="max-w-2xl">
        <CardContent className="p-5">
          <PaymentForm customers={customers.map((c) => ({ id: c.id, name: c.company_name, currency: c.currency }))} invoices={openInvoices} defaultCurrency={org.default_currency} defaultDate={today()} t={t} locale={locale} />
        </CardContent>
      </Card>
    </>
  );
}
