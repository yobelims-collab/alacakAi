import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/types";
import type { LandingCopy } from "./copy";
import { HeroPreview } from "./hero-preview";
import { Container } from "./primitives";
import { Reveal } from "./reveal";

export function Hero({ copy, preview, locale }: { copy: LandingCopy["hero"]; preview: LandingCopy["preview"]; locale: Locale }) {
  return (
    <section className="relative overflow-hidden">
      {/* Faint radial glow behind the hero; the only gradient on the page. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-radial-[ellipse_70%_60%_at_50%_-10%] from-brand/12 via-ai/5 to-transparent dark:from-brand/15 dark:via-ai/8" />
      <Container className="grid items-center gap-12 pb-16 pt-14 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-16 lg:pb-24 lg:pt-24">
        <div className="max-w-xl">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ai/10 px-3 py-1 text-xs font-medium text-ai">
              <Sparkles className="size-3.5" />
              {copy.badge}
            </span>
          </Reveal>
          <Reveal delay={0.06}>
            <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">{copy.headline}</h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-5 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">{copy.sub}</p>
          </Reveal>
          <Reveal delay={0.18}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="brand" className="w-full sm:w-auto">
                <Link href="/login?demo=1">
                  {copy.demo} <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <Link href="/signup">{copy.start}</Link>
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{copy.note}</p>
          </Reveal>
        </div>
        <HeroPreview copy={preview} locale={locale} />
      </Container>
    </section>
  );
}
