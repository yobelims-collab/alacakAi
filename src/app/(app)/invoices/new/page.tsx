import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { Button } from "@/components/ui/button";
import { requireContext } from "@/lib/db";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const ctx = await requireContext();
  const { t, org } = ctx;
  const sp = await searchParams;
  const customers = (await ctx.store.list("customers", { orderBy: "company_name", ascending: true })).map((c) => ({ id: c.id, company_name: c.company_name, payment_terms_days: c.payment_terms_days, currency: c.currency }));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t.invoices.new}
        subtitle={t.invoices.subtitle}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/invoices">
              <ArrowLeft /> {t.common.back}
            </Link>
          </Button>
        }
      />
      {customers.length === 0 ? (
        <EmptyState
          title={t.customers.noCustomers}
          action={
            <Button asChild variant="brand" size="sm">
              <Link href="/customers/new">{t.customers.new}</Link>
            </Button>
          }
        />
      ) : (
        <InvoiceForm t={t} customers={customers} defaults={{ paymentTermsDays: org.default_payment_terms_days, currency: org.default_currency }} initialCustomerId={sp.customer} />
      )}
    </div>
  );
}
