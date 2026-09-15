import type { Currency, Locale, Organization } from "@/lib/types";

const SYMBOLS: Record<Currency, string> = { TRY: "₺", EUR: "€", USD: "$", GBP: "£" };

export function currencySymbol(c: Currency): string {
  return SYMBOLS[c] ?? c;
}

export function formatMoney(
  amount: number,
  currency: Currency,
  locale: Locale = "tr",
  opts: { compact?: boolean } = {},
): string {
  const nf = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: opts.compact ? 0 : 2,
    maximumFractionDigits: opts.compact ? 0 : 2,
  });
  return `${SYMBOLS[currency] ?? currency}${nf.format(amount)}`;
}

/** Convert `amount` in `from` to the organization's reporting currency using stored FX rates. */
export function toReporting(
  amount: number,
  from: Currency,
  org: Pick<Organization, "reporting_currency" | "fx_rates">,
): number {
  if (from === org.reporting_currency) return amount;
  const rate = org.fx_rates?.[from];
  if (!rate) return amount; // unknown rate: treat 1:1 rather than hiding money; settings warn about it.
  return amount * rate;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Parses "18.500,00", "18,500.00", "18500" -> 18500. */
export function parseAmount(raw: string | number): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = raw.trim().replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
