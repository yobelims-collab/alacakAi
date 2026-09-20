import { CalendarClock, Gauge, UserCheck } from "lucide-react";
import { Container } from "./primitives";
import { Reveal } from "./reveal";

const ICONS = [CalendarClock, UserCheck, Gauge];

/** Three product facts in place of a partner-logo strip (we have no partners to show). */
export function FactsStrip({ facts }: { facts: string[] }) {
  return (
    <section className="border-y bg-card/60">
      <Container>
        <Reveal>
          <ul className="grid gap-x-8 gap-y-3 py-5 text-sm text-muted-foreground sm:grid-cols-3 sm:py-6">
            {facts.map((f, i) => {
              const Icon = ICONS[i] ?? Gauge;
              return (
                <li key={f} className="flex items-center gap-2.5 sm:justify-center">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md border bg-background">
                    <Icon className="size-3.5 text-brand" />
                  </span>
                  <span>{f}</span>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}
