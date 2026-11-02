"use client";

import { LogoMark } from "@/components/app/logo";
import { BorderBeam } from "@/components/magicui/border-beam";

import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion, type Variants } from "motion/react";
import { Bot, Inbox } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { Locale } from "@/lib/types";
import type { FeedTone, LandingCopy, RowStatus, StatKind } from "./copy";
import { GradeChip } from "./primitives";

const EASE = [0.22, 1, 0.36, 1] as const;

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } } };
const item: Variants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } };

const STATUS_VARIANT: Record<RowStatus, BadgeVariant> = { sent: "success", pending: "warning", decision: "serious" };
const DOT: Record<FeedTone, string> = { info: "bg-brand", warning: "bg-amber-500", success: "bg-emerald-500" };

function formatStat(kind: StatKind, v: number, locale: Locale): string {
  const nf = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: 0 });
  if (kind === "money") return `₺${nf.format(Math.round(v))}`;
  if (kind === "percent") return locale === "tr" ? `%${v.toFixed(1).replace(".", ",")}` : `${v.toFixed(1)}%`;
  return nf.format(Math.round(v));
}

/** Counts from 0 to `value` after mount; SSR renders the final value so there is no hydration mismatch. */
function Counter({ value, kind, locale }: { value: number; kind: StatKind; locale: Locale }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, value, { duration: 1.4, delay: 0.35, ease: EASE, onUpdate: (v) => setDisplay(v) });
    return () => controls.stop();
  }, [value, reduce]);
  return <span className="tabular">{formatStat(kind, display, locale)}</span>;
}

export function HeroPreview({ copy, locale }: { copy: LandingCopy["preview"]; locale: Locale }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="relative w-full min-w-0"
      initial={reduce ? false : { opacity: 0, y: 24, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
      aria-label={copy.dataNote}
    >
      <div className="relative rounded-2xl border border-border/80 bg-muted/40 p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_60px_-24px_rgba(15,23,42,0.25)] dark:bg-muted/20 dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)]">
        {!reduce && <BorderBeam size={90} duration={9} colorFrom="var(--logo-from)" colorTo="var(--logo-to)" borderWidth={1.5} />}
        <motion.div className="overflow-hidden rounded-xl border bg-card" variants={container} initial={reduce ? false : "hidden"} animate="show">
          {/* Title bar */}
          <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
            <div className="flex items-center gap-2">
              <LogoMark className="size-5" />
              <span className="text-xs font-medium">
                {copy.title} <span className="text-muted-foreground">· {copy.demo}</span>
              </span>
            </div>
            <Badge variant="neutral">{copy.dataNote}</Badge>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
            {copy.stats.map((s, i) => (
              <motion.div key={s.label} variants={item} className="min-w-0 rounded-lg border bg-background px-3 py-2.5">
                <p className="line-clamp-2 text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">{s.label}</p>
                <p className={`mt-1 text-sm font-semibold tabular tracking-tight sm:text-base ${i === 1 ? "text-ai" : ""}`}>
                  <Counter value={s.value} kind={s.kind} locale={locale} />
                </p>
              </motion.div>
            ))}
          </div>

          {/* AI inbox */}
          <div className="border-t px-3 pb-3 pt-2.5">
            <div className="mb-2 flex items-center gap-1.5 px-1">
              <Inbox className="size-3.5 text-muted-foreground" />
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{copy.inboxTitle}</p>
            </div>
            <ul className="flex flex-col gap-1.5">
              {copy.rows.map((r) => (
                <motion.li key={r.customer} variants={item} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-lg border bg-background px-3 py-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]">
                  <GradeChip grade={r.grade} />
                  <span className="truncate font-medium">{r.customer}</span>
                  <span className="font-semibold tabular sm:order-none">{r.amount}</span>
                  <span className="col-start-2 text-xs text-muted-foreground tabular sm:col-start-auto">{r.overdue}</span>
                  <Badge variant={STATUS_VARIANT[r.status]} className="col-start-3 justify-self-end sm:col-start-auto">{copy.status[r.status]}</Badge>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* AI activity feed */}
          <div className="border-t bg-muted/30 px-4 py-3">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="grid size-5 place-items-center rounded bg-ai/10 text-ai">
                <Bot className="size-3" />
              </span>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{copy.feedTitle}</p>
            </div>
            <ul className="flex flex-col gap-1.5">
              {copy.feed.map((f) => (
                <motion.li key={f.text} variants={item} className="flex items-center gap-2.5 text-xs text-foreground/90">
                  <span className={`size-1.5 shrink-0 rounded-full ${DOT[f.tone]}`} />
                  <span className="truncate">{f.text}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
