import { ArrowLeftRight, Bot, Gauge, Inbox, UserCheck, Workflow } from "lucide-react";
import type { LandingCopy } from "./copy";
import { Container, SectionHeading } from "./primitives";
import { Reveal } from "./reveal";

const ICONS = [Bot, Gauge, ArrowLeftRight, Inbox, Workflow, UserCheck];

export function Features({ copy }: { copy: LandingCopy["features"] }) {
  return (
    <section id="features" className="scroll-mt-16 border-t py-20 sm:py-24">
      <Container>
        <Reveal>
          <SectionHeading title={copy.title} sub={copy.sub} />
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {copy.items.map((item, i) => {
            const Icon = ICONS[i] ?? Bot;
            return (
              <Reveal key={item.title} delay={(i % 3) * 0.07} className="h-full">
                <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card p-6 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-transparent hover:shadow-lg hover:shadow-cta-to/10">
                  <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl border border-transparent opacity-0 transition-opacity duration-200 [background:linear-gradient(var(--card),var(--card))_padding-box,linear-gradient(120deg,var(--logo-from),var(--logo-to))_border-box] group-hover:opacity-100" />
                  <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--logo-from)_25%,transparent),transparent)] opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" />
                  <span className="relative grid size-9 place-items-center rounded-md border bg-background">
                    <Icon className="size-4 text-brand" />
                  </span>
                  <h3 className="relative mt-5 text-sm font-semibold">{item.title}</h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
