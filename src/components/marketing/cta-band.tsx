import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DotPattern } from "@/components/magicui/dot-pattern";
import { Button } from "@/components/ui/button";
import type { LandingCopy } from "./copy";
import { Container } from "./primitives";
import { Reveal } from "./reveal";

export function CtaBand({ copy }: { copy: LandingCopy["cta"] }) {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl bg-[#0f1f3a] px-6 py-12 text-center text-white sm:px-12 sm:py-16">
            <DotPattern aria-hidden width={20} height={20} cr={1} className="fill-white/10 [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_30%,transparent_100%)]" />
            <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/2 h-64 w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(45,199,138,0.35),transparent)] blur-2xl" />
            <h2 className="relative mx-auto max-w-2xl text-balance text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">{copy.title}</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-pretty text-sm text-white/75 sm:text-base">{copy.sub}</p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="brand" className="w-full bg-[linear-gradient(90deg,#047857,#0e7490)] text-white sm:w-auto">
                <Link href="/login?demo=1">
                  {copy.demo} <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto">
                <Link href="/signup">{copy.start}</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
