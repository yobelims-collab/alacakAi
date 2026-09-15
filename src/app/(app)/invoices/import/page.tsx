import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { CsvImport } from "@/components/invoices/csv-import";
import { Button } from "@/components/ui/button";
import { requireContext } from "@/lib/db";
import { INVOICE_CSV_SAMPLE } from "@/lib/services/import-service";

export const metadata = { title: "Import invoices" };

export default async function ImportInvoicesPage() {
  const ctx = await requireContext();
  const { t, locale } = ctx;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t.invoices.importCsv}
        subtitle={t.invoices.subtitle}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/invoices">
              <ArrowLeft /> {t.common.back}
            </Link>
          </Button>
        }
      />
      <CsvImport t={t} locale={locale} sample={INVOICE_CSV_SAMPLE} />
    </div>
  );
}
