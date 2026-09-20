import { Bot, Check, MessageSquareText, PackageX, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LandingCopy } from "./copy";
import { Container, GradeChip } from "./primitives";
import { Reveal } from "./reveal";

/** The "Decision needed" card: pure markup, first tone tab shown as selected. */
function DecisionCard({ card }: { card: LandingCopy["ai"]["card"] }) {
  const [softTab, firmTab] = card.tabs;
  return (
    <div className="rounded-2xl border border-border/80 bg-muted/40 p-1.5 dark:bg-muted/20">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Badge variant="serious">{card.header}</Badge>
          </div>
          <span className="text-xs text-muted-foreground tabular">{card.overdue}</span>
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <GradeChip grade={card.grade} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{card.customer}</p>
            <p className="text-xs text-muted-foreground">
              INV-2026-00182 · <span className="font-semibold tabular text-foreground">{card.amount}</span>
            </p>
          </div>
        </div>

        <div className="mx-4 rounded-lg border bg-background px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <MessageSquareText className="size-3" /> {card.messageLabel}
          </p>
          <p className="mt-1 text-sm">“{card.message}”</p>
        </div>

        <div className="px-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <Bot className="size-3 text-ai" /> {card.draftLabel}
            </p>
            <div className="inline-flex rounded-md border bg-muted/50 p-0.5 text-xs">
              <span className="rounded-[5px] bg-card px-2.5 py-1 font-medium shadow-xs">{softTab}</span>
              <span className="px-2.5 py-1 text-muted-foreground">{firmTab}</span>
            </div>
          </div>
          <p className="mt-2 rounded-lg border border-ai/20 bg-ai/5 px-3 py-2.5 text-sm leading-relaxed">{card.drafts[0]}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3 mt-4">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium">
            <Check className="size-3.5" /> {card.extend}
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium text-red-700 dark:text-red-300">
            <PackageX className="size-3.5" /> {card.hold}
          </span>
          <span className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-medium text-brand-foreground">
            <Send className="size-3.5" /> {card.send}
          </span>
        </div>
      </div>
    </div>
  );
}

export function AiCollection({ copy }: { copy: LandingCopy["ai"] }) {
  return (
    <section className="border-t bg-card/40 py-20 sm:py-24">
      <Container className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ai/10 px-3 py-1 text-xs font-medium text-ai">
            <Bot className="size-3.5" /> {copy.badge}
          </span>
          <h2 className="mt-4 text-balance text-2xl font-semibold tracking-tight sm:text-3xl lg:text-[2.125rem] lg:leading-[1.15]">{copy.title}</h2>
          <p className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">{copy.body}</p>
          <ul className="mt-6 flex flex-col gap-3 text-sm">
            {copy.points.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  <Check className="size-3" />
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.1}>
          <DecisionCard card={copy.card} />
        </Reveal>
      </Container>
    </section>
  );
}
