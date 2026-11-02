import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { DotPattern } from "@/components/magicui/dot-pattern";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/types";
import type { LandingCopy } from "./copy";
import { HeroPreview } from "./hero-preview";
import { Container } from "./primitives";
import { Reveal } from "./reveal";

/** Renders the headline with its closing phrase in the logo gradient. */
function renderHeadline(headline: string, accent: string) {
  const i = accent ? headline.lastIndexOf(accent) : -1;
  if (i < 0) return headline;
  return (
    <>
      {headline.slice(0, i)}
      <span className="text-logo-gradient">{accent}</span>
    </>
  );
}

export function Hero({ copy, preview, locale }: { copy: LandingCopy["hero"]; preview: LandingCopy["preview"]; locale: Locale }) {
  return (
    <section className="relative overflow-hidden">
      {/* Dotted grid fading out from the top, plus a soft glow in the logo colours. */}
      <DotPattern aria-hidden width={22} height={22} cr={1} className="-z-10 fill-foreground/[0.09] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_0%,#000_40%,transparent_100%)]" />
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--logo-from)_22%,transparent),transparent)] blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -right-40 top-24 -z-10 h-[420px] w-[520px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--logo-to)_18%,transparent),transparent)] blur-2xl" />
      <Container className="grid items-center gap-12 pb-16 pt-14 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-16 lg:pb-24 lg:pt-24">
        <div className="max-w-xl">
          <Reveal>
            <span className="glass inline-flex items-center gap-1.5 rounded-full border border-border/80 px-3 py-1 text-xs font-medium text-ai shadow-xs">
              <Sparkles className="size-3.5" />
              {copy.badge}
            </span>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="mt-5 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.4rem]">{renderHeadline(copy.headline, copy.accent)}</h2>
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
