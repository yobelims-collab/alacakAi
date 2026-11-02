import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { CustomerForm } from "@/components/customers/customer-form";
import { Button } from "@/components/ui/button";
import { requireContext } from "@/lib/db";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/domain/roles";

export const metadata = { title: "Edit customer" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const { t, org, locale } = ctx;
  const managers = (await ctx.store.list("profiles", { orderBy: "full_name", ascending: true })).filter((p) => ACCOUNT_MANAGER_ROLES.includes(p.role));
  const customer = await ctx.store.get("customers", id);
  if (!customer) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`${t.common.edit} · ${customer.company_name}`}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href={`/customers/${customer.id}`}>
              <ArrowLeft /> {t.common.back}
            </Link>
          </Button>
        }
      />
      <CustomerForm t={t} customer={customer} defaults={{ paymentTermsDays: org.default_payment_terms_days, currency: org.default_currency, language: org.language }} managers={managers.map((m) => ({ id: m.id, full_name: m.full_name, email: m.email }))} locale={locale} />
    </div>
  );
}
