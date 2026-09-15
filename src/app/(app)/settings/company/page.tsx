import { LanguageSwitcher } from "@/components/app/language-switcher";
import { CompanyForm } from "@/components/settings/company-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireContext } from "@/lib/db";

export const metadata = { title: "Company settings" };

const COPY = {
  tr: {
    languageHint: "Arayüz dili; yalnızca sizin oturumunuz için geçerlidir ve müşteri mesajlarını etkilemez.",
    currencyHint: "Faturalar kendi para biriminde tutulur. Dashboard toplamları, aşağıdaki kur tablosu kullanılarak raporlama para birimine çevrilir.",
    reportingNow: "Raporlama para birimi",
  },
  en: {
    languageHint: "Interface language; applies to your session only and does not affect customer messages.",
    currencyHint: "Invoices keep their own currency. Dashboard totals are converted to the reporting currency using the FX table below.",
    reportingNow: "Reporting currency",
  },
};

export default async function CompanySettingsPage() {
  const { t, locale, org } = await requireContext();
  const c = COPY[locale];
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.settings.language}</CardTitle>
            <CardDescription>{c.languageHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageSwitcher locale={locale} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t.settings.currency}</CardTitle>
            <CardDescription>{c.currencyHint}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <span className="text-muted-foreground">{c.reportingNow}:</span> <span className="font-mono font-medium">{org.reporting_currency}</span>
          </CardContent>
        </Card>
      </div>
      <CompanyForm org={org} t={t} locale={locale} />
    </>
  );
}
