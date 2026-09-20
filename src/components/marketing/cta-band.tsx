import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LandingCopy } from "./copy";
import { Container } from "./primitives";
import { Reveal } from "./reveal";

export function CtaBand({ copy }: { copy: LandingCopy["cta"] }) {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <Reveal>
          <div className="rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12 sm:py-16">
            <h2 className="mx-auto max-w-2xl text-balance text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">{copy.title}</h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-sm text-primary-foreground/75 sm:text-base">{copy.sub}</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="brand" className="w-full sm:w-auto">
                <Link href="/login?demo=1">
                  {copy.demo} <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full border-primary-foreground/25 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto">
                <Link href="/signup">{copy.start}</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
