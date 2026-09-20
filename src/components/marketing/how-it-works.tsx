import { ArrowLeftRight, MessagesSquare, Radar, Upload } from "lucide-react";
import type { LandingCopy } from "./copy";
import { Container, SectionHeading } from "./primitives";
import { Reveal } from "./reveal";

const ICONS = [Upload, Radar, MessagesSquare, ArrowLeftRight];

export function HowItWorks({ copy }: { copy: LandingCopy["how"] }) {
  return (
    <section id="how" className="scroll-mt-16 py-20 sm:py-24">
      <Container>
        <Reveal>
          <SectionHeading title={copy.title} sub={copy.sub} />
        </Reveal>
        <div className="relative mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {copy.steps.map((step, i) => {
            const Icon = ICONS[i] ?? Upload;
            return (
              <Reveal key={step.title} delay={i * 0.07} className="h-full">
                <div className="flex h-full flex-col rounded-xl border bg-card p-6 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
                      <Icon className="size-4" />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground tabular">0{i + 1}</span>
                  </div>
                  <h3 className="mt-5 text-sm font-semibold leading-snug">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
