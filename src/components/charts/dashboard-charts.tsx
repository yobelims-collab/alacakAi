"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardMetrics } from "@/lib/domain/metrics";
import type { Currency, Locale } from "@/lib/types";

const SERIES = { blue: "#2a78d6", orange: "#eb6834", aqua: "#1baf7a" };

function compact(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
function full(n: number, locale: Locale, currency: Currency): string {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}
function shortDate(d: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
}
function monthLabel(m: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
}

const axisStyle = { fontSize: 11, fill: "#6b7280" };
const tooltipStyle = { fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" };

export function ReceivablesChart({ data, locale, currency, labels }: { data: DashboardMetrics["receivablesSeries"]; locale: Locale; currency: Currency; labels: { outstanding: string; overdue: string } }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES.blue} stopOpacity={0.18} />
            <stop offset="100%" stopColor={SERIES.blue} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gOvd" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES.orange} stopOpacity={0.18} />
            <stop offset="100%" stopColor={SERIES.orange} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="date" tickFormatter={(d) => shortDate(String(d), locale)} tick={axisStyle} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tickFormatter={(v) => compact(Number(v), locale)} tick={axisStyle} axisLine={false} tickLine={false} width={48} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => full(Number(v), locale, currency)} labelFormatter={(l) => shortDate(String(l), locale)} />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="outstanding" name={labels.outstanding} stroke={SERIES.blue} strokeWidth={2} fill="url(#gOut)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        <Area type="monotone" dataKey="overdue" name={labels.overdue} stroke={SERIES.orange} strokeWidth={2} fill="url(#gOvd)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function AgingChart({ data, locale, currency, unit }: { data: DashboardMetrics["aging"]; locale: Locale; currency: Currency; unit: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="bucket" tickFormatter={(b) => `${b} ${unit}`} tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => compact(Number(v), locale)} tick={axisStyle} axisLine={false} tickLine={false} width={48} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f8fafc" }} formatter={(v, _n, item) => [`${full(Number(v), locale, currency)} · ${(item.payload as { count: number }).count}`, ""]} labelFormatter={(l) => `${l} ${unit}`} />
        <Bar dataKey="amount" fill={SERIES.orange} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CollectedVsOutstandingChart({ data, locale, currency, labels }: { data: DashboardMetrics["collectedVsOutstanding"]; locale: Locale; currency: Currency; labels: { collected: string; outstanding: string } }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="24%">
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="month" tickFormatter={(m) => monthLabel(String(m), locale)} tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => compact(Number(v), locale)} tick={axisStyle} axisLine={false} tickLine={false} width={48} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f8fafc" }} formatter={(v) => full(Number(v), locale, currency)} labelFormatter={(l) => monthLabel(String(l), locale)} />
        <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="collected" name={labels.collected} fill={SERIES.aqua} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        <Bar dataKey="outstanding" name={labels.outstanding} fill={SERIES.blue} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
