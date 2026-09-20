import type { Locale } from "@/lib/types";
import type { LandingCopy } from "./copy";
import { PricingGrid } from "./pricing";
import { Container, SectionHeading } from "./primitives";
import { Reveal } from "./reveal";

export function PricingSection({ copy, locale }: { copy: LandingCopy["pricing"]; locale: Locale }) {
  return (
    <section id="pricing" className="scroll-mt-16 border-t bg-card/40 py-20 sm:py-24">
      <Container>
        <Reveal>
          <SectionHeading title={copy.title} sub={copy.sub} />
        </Reveal>
        <Reveal delay={0.08}>
          <div className="mt-12">
            <PricingGrid locale={locale} ctaHref="/signup" />
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground">{copy.note}</p>
        </Reveal>
      </Container>
    </section>
  );
}
