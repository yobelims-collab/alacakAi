import { ChevronDown } from "lucide-react";
import type { LandingCopy } from "./copy";
import { Container, SectionHeading } from "./primitives";
import { Reveal } from "./reveal";

export function Faq({ copy }: { copy: LandingCopy["faq"] }) {
  return (
    <section id="faq" className="scroll-mt-16 border-t py-20 sm:py-24">
      <Container className="max-w-3xl">
        <Reveal>
          <SectionHeading title={copy.title} sub={copy.sub} />
        </Reveal>
        <Reveal delay={0.08}>
          <div className="mt-10 divide-y rounded-xl border bg-card shadow-xs">
            {copy.items.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
