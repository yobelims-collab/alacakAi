import type { Metadata } from "next";
import { AiCollection } from "@/components/marketing/ai-collection";
import { LANDING_COPY } from "@/components/marketing/copy";
import { CtaBand } from "@/components/marketing/cta-band";
import { FactsStrip } from "@/components/marketing/facts-strip";
import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { MarketingFooter } from "@/components/marketing/footer";
import { Grades } from "@/components/marketing/grades";
import { CinematicHero, PillNav } from "@/components/marketing/cinematic-hero";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { PricingSection } from "@/components/marketing/pricing-section";
import { getSessionUser } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { meta } = LANDING_COPY[locale];
  return { title: { absolute: meta.title }, description: meta.description };
}

export default async function LandingPage() {
  const [locale, user] = await Promise.all([getLocale(), getSessionUser()]);
  const c = LANDING_COPY[locale];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PillNav copy={c.hero} nav={c.nav} locale={locale} signedIn={Boolean(user)} />
      <main className="flex-1">
        <CinematicHero copy={c.hero} />
        <Hero copy={c.hero} preview={c.preview} locale={locale} />
        <FactsStrip facts={c.facts} />
        <HowItWorks copy={c.how} />
        <AiCollection copy={c.ai} />
        <Features copy={c.features} />
        <Grades copy={c.grades} />
        <PricingSection copy={c.pricing} locale={locale} />
        <Faq copy={c.faq} />
        <CtaBand copy={c.cta} />
      </main>
      <MarketingFooter copy={c.footer} nav={c.nav} />
    </div>
  );
}
