import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { CustomerForm } from "@/components/customers/customer-form";
import { Button } from "@/components/ui/button";
import { requireContext } from "@/lib/db";

export const metadata = { title: "New customer" };

export default async function NewCustomerPage() {
  const ctx = await requireContext();
  const { t, org } = ctx;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t.customers.new}
        subtitle={t.customers.subtitle}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/customers">
              <ArrowLeft /> {t.common.back}
            </Link>
          </Button>
        }
      />
      <CustomerForm t={t} defaults={{ paymentTermsDays: org.default_payment_terms_days, currency: org.default_currency, language: org.language }} />
    </div>
  );
}
