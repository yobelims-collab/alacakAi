import { Info } from "lucide-react";
import type { Grade } from "@/lib/types";
import type { LandingCopy } from "./copy";
import { Container, GradeChip, SectionHeading } from "./primitives";
import { Reveal } from "./reveal";

const LETTERS: Grade[] = ["A", "B", "C", "D", "E"];

export function Grades({ copy }: { copy: LandingCopy["grades"] }) {
  const { card } = copy;
  return (
    <section className="border-t bg-card/40 py-20 sm:py-24">
      <Container className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <SectionHeading align="left" title={copy.title} sub={copy.sub} />
          <ul className="mt-8 flex flex-col divide-y rounded-xl border bg-card shadow-xs">
            {LETTERS.map((g) => (
              <li key={g} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <GradeChip grade={g} />
                <span className="font-medium">{copy.letters[g]}</span>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="rounded-2xl border border-border/80 bg-muted/40 p-1.5 dark:bg-muted/20">
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-4">
                <GradeChip grade={card.grade} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{card.customer}</p>
                  <p className="text-sm text-muted-foreground">
                    {card.grade} · {card.label}
                  </p>
                </div>
              </div>
              <p className="mt-5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{card.factsLabel}</p>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {card.facts.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-orange-500" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-lg border bg-background p-3 text-sm">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{card.ruleLabel}</p>
                <p className="mt-1 font-medium">{card.rule}</p>
              </div>
              <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 size-3 shrink-0" /> {card.disclaimer}
              </p>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
