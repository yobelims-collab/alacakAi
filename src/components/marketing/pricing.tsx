import Link from "next/link";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/types";
import { cn } from "@/lib/utils";

export type PricingPlanId = "starter" | "growth" | "business";

export interface PricingPlan {
  id: PricingPlanId;
  name: string;
  price: Record<Locale, string>;
  period: Record<Locale, string>;
  description: Record<Locale, string>;
  features: Record<Locale, string[]>;
  highlighted?: boolean;
}

/**
 * Single source of truth for the (placeholder) plans. Used by the landing page and the
 * billing settings page. Prices are illustrative — billing is not wired in this version.
 */
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: { tr: "₺1.490", en: "₺1,490" },
    period: { tr: "/ay", en: "/mo" },
    description: { tr: "Küçük ekipler için temel tahsilat takibi.", en: "Core collections tracking for small teams." },
    features: {
      tr: ["100 aktif fatura", "1 kullanıcı", "E-posta hatırlatmaları", "AI yanıt sınıflandırma", "CSV içe aktarım"],
      en: ["100 active invoices", "1 user", "Email reminders", "AI reply classification", "CSV import"],
    },
  },
  {
    id: "growth",
    name: "Growth",
    price: { tr: "₺3.990", en: "₺3,990" },
    period: { tr: "/ay", en: "/mo" },
    description: { tr: "Büyüyen finans ekipleri için otomasyon ve risk.", en: "Automation and risk for growing finance teams." },
    features: {
      tr: ["1.000 aktif fatura", "5 kullanıcı", "E-posta + WhatsApp", "Risk skorlama ve öncelik", "Ödeme mutabakatı", "Otomasyon kuralları"],
      en: ["1,000 active invoices", "5 users", "Email + WhatsApp", "Risk scoring and prioritisation", "Payment reconciliation", "Automation rules"],
    },
    highlighted: true,
  },
  {
    id: "business",
    name: "Business",
    price: { tr: "Özel fiyat", en: "Custom" },
    period: { tr: "", en: "" },
    description: { tr: "Çok şirketli yapılar ve özel entegrasyonlar.", en: "Multi-entity groups and custom integrations." },
    features: {
      tr: ["Sınırsız fatura", "Sınırsız kullanıcı", "ERP / banka entegrasyonu", "Özel AI ton ve kuralları", "Öncelikli destek", "SLA"],
      en: ["Unlimited invoices", "Unlimited users", "ERP / bank integration", "Custom AI tone and rules", "Priority support", "SLA"],
    },
  },
];

const COPY = {
  tr: { cta: "Ücretsiz Başla", contact: "Bize ulaşın", current: "Mevcut plan", popular: "En popüler" },
  en: { cta: "Start free", contact: "Contact us", current: "Current plan", popular: "Most popular" },
};

export function PricingGrid({ locale, currentPlanId, ctaHref = "/signup", showCta = true }: { locale: Locale; currentPlanId?: PricingPlanId; ctaHref?: string; showCta?: boolean }) {
  const c = COPY[locale];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {PRICING_PLANS.map((plan) => {
        const current = plan.id === currentPlanId;
        return (
          <div key={plan.id} className={cn("relative flex flex-col rounded-2xl border bg-card p-6 shadow-xs sm:p-7", plan.highlighted && "border-brand/60 ring-1 ring-brand/30 shadow-[0_16px_40px_-24px_rgba(42,120,214,0.45)]")}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold tracking-tight">{plan.name}</h3>
              {current ? <Badge variant="success">{c.current}</Badge> : plan.highlighted ? <Badge variant="info">{c.popular}</Badge> : null}
            </div>
            <p className="mt-1.5 min-h-8 text-xs leading-relaxed text-muted-foreground">{plan.description[locale]}</p>
            <p className="mt-6 flex items-baseline gap-1">
              <span className="text-3xl font-semibold tabular tracking-tight sm:text-4xl">{plan.price[locale]}</span>
              {plan.period[locale] && <span className="text-sm text-muted-foreground">{plan.period[locale]}</span>}
            </p>
            <div className="my-6 border-t" />
            <ul className="flex flex-1 flex-col gap-2.5 text-sm">
              {plan.features[locale].map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    <Check className="size-2.5" />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {showCta && current && (
              <Button variant="outline" className="mt-8 w-full" disabled>
                {c.current}
              </Button>
            )}
            {showCta && !current && (
              <Button asChild variant={plan.highlighted ? "brand" : "outline"} className="mt-8 w-full">
                <Link href={plan.id === "business" ? "mailto:hello@alacakai.app" : ctaHref}>{plan.id === "business" ? c.contact : c.cta}</Link>
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
