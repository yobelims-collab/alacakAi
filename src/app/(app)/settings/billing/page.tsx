import { CreditCard } from "lucide-react";
import { PRICING_PLANS, PricingGrid } from "@/components/marketing/pricing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireContext } from "@/lib/db";

export const metadata = { title: "Billing" };

const COPY = {
  tr: { plans: "Planlar", plansHint: "Fiyatlar yer tutucudur; ödeme altyapısı bu sürümde bağlı değildir.", perMonth: "aylık" },
  en: { plans: "Plans", plansHint: "Prices are placeholders; no payment provider is connected in this version.", perMonth: "monthly" },
};

export default async function BillingSettingsPage() {
  const { t, locale } = await requireContext();
  const c = COPY[locale];
  const current = PRICING_PLANS[0];
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" /> {t.settings.currentPlan}
          </CardTitle>
          <CardDescription>{t.settings.billingPlaceholder}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant="default">{current.name}</Badge>
          <span className="text-sm tabular">
            {current.price[locale]}
            <span className="text-muted-foreground">{current.period[locale]}</span>
          </span>
        </CardContent>
      </Card>
      <div>
        <h2 className="mb-1 text-sm font-semibold">{c.plans}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{c.plansHint}</p>
        <PricingGrid locale={locale} currentPlanId={current.id} showCta={false} />
      </div>
    </>
  );
}
