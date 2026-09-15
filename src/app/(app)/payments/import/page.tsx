import { PageHeader } from "@/components/app/page-header";
import { BankImport } from "@/components/payments/bank-import";
import { requireContext } from "@/lib/db";
import { BANK_CSV_SAMPLE } from "@/lib/services/import-service";

export const metadata = { title: "Bank CSV import" };

export default async function BankImportPage() {
  const { t, locale } = await requireContext();
  return (
    <>
      <PageHeader title={t.payments.importBank} subtitle={t.payments.bankCsvHint} />
      <BankImport sample={BANK_CSV_SAMPLE} t={t} locale={locale} />
    </>
  );
}
