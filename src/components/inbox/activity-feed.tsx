"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Bot } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { AiAction, Locale, Severity } from "@/lib/types";

const DOT: Record<Severity, string> = { INFO: "bg-brand", SUCCESS: "bg-emerald-500", WARNING: "bg-amber-500", CRITICAL: "bg-red-500" };

function relative(iso: string, locale: Locale): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.round(diff / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale === "tr" ? "tr" : "en", { numeric: "auto" });
  if (min < 60) return rtf.format(-min, "minute");
  const h = Math.round(min / 60);
  if (h < 24) return rtf.format(-h, "hour");
  return rtf.format(-Math.round(h / 24), "day");
}

/** What the AI did recently, newest first. Mirrors the full journal under AI Actions. */
export function ActivityFeed({ actions, customers, t, locale }: { actions: AiAction[]; customers: Record<string, string>; t: Dictionary; locale: Locale }) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <span className="grid size-6 place-items-center rounded-md bg-ai/10 text-ai">
          <Bot className="size-3.5" />
        </span>
        <p className="text-sm font-semibold">{t.dashboard.recentActions}</p>
        <Link href="/ai-actions" className="ml-auto text-xs text-muted-foreground hover:text-foreground">{t.dashboard.viewAll}</Link>
      </div>
      <ul className="flex flex-col px-4 py-2">
        {actions.length === 0 && <li className="py-3 text-sm text-muted-foreground">{t.aiActions.noActions}</li>}
        {actions.map((a, i) => (
          <motion.li key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.25 }} className="flex gap-3 border-b py-2.5 last:border-0">
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT[a.severity]}`} />
            <div className="min-w-0">
              <p className="truncate text-sm">{t.actionType[a.type]}</p>
              <p className="truncate text-xs text-muted-foreground">
                {a.customer_id && customers[a.customer_id] ? `${customers[a.customer_id]} · ` : ""}
                {relative(a.created_at, locale)}
              </p>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
