import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { CsvImport } from "@/components/invoices/csv-import";
import { EFaturaImport } from "@/components/invoices/efatura-import";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireContext } from "@/lib/db";
import { INVOICE_CSV_SAMPLE } from "@/lib/services/import-service";

export const metadata = { title: "Import invoices" };

const COPY = {
  tr: { title: "Fatura içe aktar", csv: "CSV", efatura: "e-Fatura XML" },
  en: { title: "Import invoices", csv: "CSV", efatura: "e-Fatura XML" },
};

export default async function ImportInvoicesPage() {
  const ctx = await requireContext();
  const { t, locale } = ctx;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={COPY[locale].title}
        subtitle={t.invoices.subtitle}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/invoices">
              <ArrowLeft /> {t.common.back}
            </Link>
          </Button>
        }
      />
      <Tabs defaultValue="csv">
        <TabsList>
          <TabsTrigger value="csv">{COPY[locale].csv}</TabsTrigger>
          <TabsTrigger value="efatura">{COPY[locale].efatura}</TabsTrigger>
        </TabsList>
        <TabsContent value="csv">
          <CsvImport t={t} locale={locale} sample={INVOICE_CSV_SAMPLE} />
        </TabsContent>
        <TabsContent value="efatura">
          <EFaturaImport locale={locale} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
