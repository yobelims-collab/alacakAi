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
                <div className="flex h-full flex-col rounded-xl border bg-card p-6 shadow-xs transition-colors hover:border-brand/40">
                  <span className="grid size-9 place-items-center rounded-md border bg-background">
                    <Icon className="size-4 text-brand" />
                  </span>
                  <h3 className="mt-5 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
