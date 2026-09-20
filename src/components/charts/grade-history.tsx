"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Locale, RiskHistoryPoint } from "@/lib/types";

const GRADE_COLOR: Record<string, string> = { A: "#008300", B: "#1baf7a", C: "#eda100", D: "#eb6834", E: "#e34948" };

function monthLabel(m: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
}

/** Score by month, each bar coloured by the grade it mapped to. Higher = riskier. */
export function GradeHistoryChart({ history, locale }: { history: RiskHistoryPoint[]; locale: Locale }) {
  if (history.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={history} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
        <XAxis dataKey="month" tickFormatter={(m) => monthLabel(String(m), locale)} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} hide />
        <Tooltip
          cursor={{ fill: "var(--accent)" }}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)", color: "var(--popover-foreground)" }}
          formatter={(v, _n, item) => [`${v}/100 · ${(item.payload as RiskHistoryPoint).grade}${(item.payload as RiskHistoryPoint).note ? ` (${(item.payload as RiskHistoryPoint).note})` : ""}`, ""]}
          labelFormatter={(l) => monthLabel(String(l), locale)}
        />
        <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
          {history.map((h) => (
            <Cell key={h.month} fill={GRADE_COLOR[h.grade]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
