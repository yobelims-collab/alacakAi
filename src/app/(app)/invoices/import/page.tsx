import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { CsvImport } from "@/components/invoices/csv-import";
import { EFaturaImport } from "@/components/invoices/efatura-import";
import { StatementImport } from "@/components/invoices/statement-import";
import { EmailImportCard, type EmailImportHistoryItem } from "@/components/invoices/email-import-card";
import { importAddress } from "@/lib/domain/inbound-email";
import { canEdit } from "@/lib/domain/roles";
import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireContext } from "@/lib/db";
import { EMAIL_IMPORT_ACTION, INVOICE_CSV_SAMPLE } from "@/lib/services/import-service";

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
  const canSee = canEdit(ctx.user.role);
  const missing = [
    !env.inboundEmailDomain && "INBOUND_EMAIL_DOMAIN",
    !env.resendWebhookSecret && "RESEND_WEBHOOK_SECRET",
    !env.resendApiKey && "RESEND_API_KEY",
    !env.importSecret && "INBOUND_IMPORT_SECRET",
  ].filter((v): v is string => Boolean(v));
  const address = canSee && env.inboundEmailDomain && env.importSecret ? importAddress(ctx.org.id, env.importSecret, env.inboundEmailDomain) : null;
  const logs = canSee ? await ctx.store.list("audit_logs", { where: { action: EMAIL_IMPORT_ACTION }, orderBy: "created_at", ascending: false, limit: 5 }) : [];
  const history: EmailImportHistoryItem[] = logs.map((l) => {
    const d = (l.details ?? {}) as Record<string, unknown>;
    return { at: l.created_at, file: String(d.file ?? "—"), ok: d.ok === true, error: typeof d.error === "string" ? d.error : null, imported: Number(d.imported ?? 0), payments: Number(d.payments ?? 0) };
  });
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
          <div className="flex flex-col gap-4">
            <StatementImport locale={locale} demo={ctx.demo} />
            <EmailImportCard locale={locale} address={address} missing={missing} canSee={canSee} demo={ctx.demo} history={history} />
          </div>
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
