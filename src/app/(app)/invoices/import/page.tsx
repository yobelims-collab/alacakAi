import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { CsvImport } from "@/components/invoices/csv-import";
import { EFaturaImport } from "@/components/invoices/efatura-import";
import { StatementImport } from "@/components/invoices/statement-import";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireContext } from "@/lib/db";
import { INVOICE_CSV_SAMPLE } from "@/lib/services/import-service";

export const metadata = { title: "Import invoices" };
/** Large statements do many writes; give the server action room on serverless hosts. */
export const maxDuration = 60;

const COPY = {
  tr: { title: "Fatura içe aktar", subtitle: "ERP cari ekstresi, e-Fatura XML veya CSV ile faturalarınızı ve tahsilatlarınızı yükleyin", erp: "ERP cari ekstre", csv: "CSV", efatura: "e-Fatura XML" },
  en: { title: "Import invoices", subtitle: "Load invoices and payments from an ERP account statement, e-Fatura XML or CSV", erp: "ERP statement", csv: "CSV", efatura: "e-Fatura XML" },
};

export default async function ImportInvoicesPage() {
  const ctx = await requireContext();
  const { t, locale } = ctx;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={COPY[locale].title}
        subtitle={COPY[locale].subtitle}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/invoices">
              <ArrowLeft /> {t.common.back}
            </Link>
          </Button>
        }
      />
      <Tabs defaultValue="erp">
        <TabsList>
          <TabsTrigger value="erp">{COPY[locale].erp}</TabsTrigger>
          <TabsTrigger value="csv">{COPY[locale].csv}</TabsTrigger>
          <TabsTrigger value="efatura">{COPY[locale].efatura}</TabsTrigger>
        </TabsList>
        <TabsContent value="erp">
          <StatementImport locale={locale} demo={ctx.demo} />
        </TabsContent>
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
