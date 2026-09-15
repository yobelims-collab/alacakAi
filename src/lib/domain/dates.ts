/** Calendar-date helpers. All "business" dates are `YYYY-MM-DD` strings interpreted in UTC. */

export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function today(): string {
  return toDateString(new Date());
}

export function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateString(d);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  const a = parseDate(from).getTime();
  const b = parseDate(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseDate(s);
  return !Number.isNaN(d.getTime()) && toDateString(d) === s;
}

/** Accepts `YYYY-MM-DD`, `DD.MM.YYYY`, `DD/MM/YYYY` and ISO timestamps. `MM/DD/YYYY` is not accepted (ambiguous). */
export function normalizeDateInput(raw: string): string | null {
  const s = raw.trim();
  if (isValidDateString(s)) return s;
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    const out = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return isValidDateString(out) ? out : null;
  }
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (iso && isValidDateString(iso[1])) return iso[1];
  return null;
}

export function formatDate(date: string | null | undefined, locale: "tr" | "en" = "tr"): string {
  if (!date) return "—";
  const d = parseDate(date.slice(0, 10));
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function formatDateTime(iso: string | null | undefined, locale: "tr" | "en" = "tr"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
