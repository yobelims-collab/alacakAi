import type { Grade, Locale, RiskLevel } from "@/lib/types";
import type { CustomerFinancials } from "@/lib/domain/metrics";
import { formatMoney } from "@/lib/domain/money";

/**
 * Explainable, deterministic payment-risk score (0–100).
 * Each factor contributes a bounded number of points; the reasons list mirrors the factors
 * that fired so the UI can show *why*. This is an internal prioritisation aid, not a credit rating.
 */
export interface RiskResult {
  score: number;
  level: RiskLevel;
  grade: Grade;
  reasons: string[];
  /** Plain-language facts a new employee understands without knowing the formula. */
  facts: string[];
  recommendation: string;
  factors: Record<string, number>;
}

/** Rating letter: A pays on time … E stop list. Thresholds on the 0–100 score. */
export function gradeForScore(score: number): Grade {
  if (score <= 15) return "A";
  if (score <= 35) return "B";
  if (score <= 60) return "C";
  if (score <= 85) return "D";
  return "E";
}

/** Default company rule per grade; editable in Settings and shown next to the letter. */
export function defaultGradeRules(locale: Locale): Record<Grade, string> {
  return locale === "tr"
    ? {
        A: "Kısıtlama yok. Standart vade ile sevkiyat yapılabilir.",
        B: "Kısıtlama yok. Vade öncesi hatırlatmalar açık kalsın.",
        C: "Açık bakiye kredi limitini aşmadığı sürece sevkiyat yapılabilir; yeni sipariş öncesi bakiyeyi kontrol edin.",
        D: "Yalnızca ön ödeme ile veya hesap yöneticisinin onayıyla sevkiyat yapın.",
        E: "Sevkiyat durduruldu. Genel müdür onayı olmadan yeni sipariş kabul etmeyin.",
      }
    : {
        A: "No restrictions. Ship on standard terms.",
        B: "No restrictions. Keep pre-due reminders on.",
        C: "Ship while the open balance stays under the credit limit; check the balance before new orders.",
        D: "Prepayment only, or shipment with the account manager's approval.",
        E: "Shipments on hold. No new orders without the general manager's approval.",
      };
}

export function plainFacts(f: CustomerFinancials, locale: Locale): string[] {
  const tr = locale === "tr";
  const out: string[] = [];
  if (f.totalInvoiced === 0) return [tr ? "Henüz fatura geçmişi yok." : "No invoice history yet."];
  if (f.averageDelayDays > 0) out.push(tr ? `Ortalama vadeden ${f.averageDelayDays} gün sonra ödüyor.` : `Pays on average ${f.averageDelayDays} days after the due date.`);
  else out.push(tr ? "Faturaları vadesinde ödüyor." : "Pays invoices on time.");
  if (f.overdueCount > 0) out.push(tr ? `Şu anda ${f.overdueCount} gecikmiş fatura var (${formatMoney(f.overdue, f.currency, "tr", { compact: true })}).` : `${f.overdueCount} invoice${f.overdueCount > 1 ? "s are" : " is"} overdue right now (${formatMoney(f.overdue, f.currency, "en", { compact: true })}).`);
  else out.push(tr ? "Şu anda gecikmiş fatura yok." : "No overdue invoices right now.");
  if (f.brokenPromises90d > 0) out.push(tr ? `Son 90 günde ${f.brokenPromises90d} ödeme sözünü tutmadı.` : `Broke ${f.brokenPromises90d} payment promise${f.brokenPromises90d > 1 ? "s" : ""} in the last 90 days.`);
  if (f.disputedCount > 0) out.push(tr ? `${f.disputedCount} faturaya itiraz etti.` : `Disputed ${f.disputedCount} invoice${f.disputedCount > 1 ? "s" : ""}.`);
  if (f.lastPaymentDate) out.push(tr ? `Son ödeme: ${f.lastPaymentDate}.` : `Last payment: ${f.lastPaymentDate}.`);
  return out;
}

export function levelForScore(score: number): RiskLevel {
  if (score >= 85) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

export function computeRiskScore(
  f: CustomerFinancials,
  opts: { creditLimit: number | null; locale?: Locale } = { creditLimit: null },
): RiskResult {
  const locale = opts.locale ?? "tr";
  const tr = locale === "tr";
  const factors: Record<string, number> = {};
  const reasons: string[] = [];

  // 1. Average payment delay (max 30)
  const delayPts = Math.min(30, Math.max(0, f.averageDelayDays) * 1.5);
  factors.average_delay = Math.round(delayPts);
  if (f.averageDelayDays > 0) {
    reasons.push(tr ? `${f.averageDelayDays} gün ortalama ödeme gecikmesi` : `${f.averageDelayDays} day average payment delay`);
  }

  // 2. Overdue invoices (max 20)
  const overduePts = Math.min(20, f.overdueCount * 6);
  factors.overdue_invoices = overduePts;
  if (f.overdueCount > 0) {
    reasons.push(tr ? `${f.overdueCount} gecikmiş fatura` : `${f.overdueCount} overdue invoice${f.overdueCount > 1 ? "s" : ""}`);
  }

  // 3. Broken promises (max 20)
  const brokenPts = Math.min(20, f.brokenPromises90d * 10);
  factors.broken_promises = brokenPts;
  if (f.brokenPromises90d > 0) {
    reasons.push(tr ? `Son 90 günde ${f.brokenPromises90d} tutulmayan ödeme sözü` : `${f.brokenPromises90d} broken payment promise${f.brokenPromises90d > 1 ? "s" : ""} in the last 90 days`);
  }

  // 4. Exposure: overdue share of outstanding and credit-limit usage (max 15)
  let exposurePts = 0;
  if (f.outstanding > 0) {
    const overdueShare = f.overdue / f.outstanding;
    exposurePts += Math.min(10, overdueShare * 10);
    if (overdueShare >= 0.5) {
      reasons.push(tr ? `Açık bakiyenin %${Math.round(overdueShare * 100)}'i gecikmiş (${formatMoney(f.outstanding, f.currency, locale, { compact: true })} açık)` : `${Math.round(overdueShare * 100)}% of outstanding balance is overdue (${formatMoney(f.outstanding, f.currency, locale, { compact: true })} outstanding)`);
    }
    if (opts.creditLimit && opts.creditLimit > 0) {
      const usage = f.outstanding / opts.creditLimit;
      if (usage > 0.9) {
        exposurePts += 5;
        reasons.push(tr ? "Kredi limiti dolmak üzere" : "Credit limit almost fully used");
      }
    }
  }
  factors.exposure = Math.round(exposurePts);

  // 5. Disputes (max 10)
  const disputePts = Math.min(10, f.disputedCount * 5);
  factors.disputes = disputePts;
  if (f.disputedCount > 0) reasons.push(tr ? `${f.disputedCount} itirazlı fatura` : `${f.disputedCount} disputed invoice${f.disputedCount > 1 ? "s" : ""}`);

  // 6. Recent payment activity (max 5): no payment at all is a mild negative; recent payment is neutral.
  let recencyPts = 0;
  if (!f.lastPaymentDate && f.totalInvoiced > 0) {
    recencyPts = 5;
    reasons.push(tr ? "Kayıtlı ödeme yok" : "No payment on record");
  }
  factors.recency = recencyPts;

  const raw = delayPts + overduePts + brokenPts + exposurePts + disputePts + recencyPts;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const level = levelForScore(score);

  const recommendation = recommendationFor(level, f, locale);
  if (reasons.length === 0) reasons.push(tr ? "Ödeme davranışı düzenli" : "Regular payment behaviour");
  return { score, level, grade: gradeForScore(score), reasons, facts: plainFacts(f, locale), recommendation, factors };
}

function recommendationFor(level: RiskLevel, f: CustomerFinancials, locale: Locale): string {
  const tr = locale === "tr";
  switch (level) {
    case "CRITICAL":
      return tr
        ? "Yeni sevkiyat ve ek kredi vermeden önce ödeme planı alın; hesabı hesap yöneticisine eskale edin."
        : "Obtain a payment plan before any new shipment or credit; escalate the account to the account manager.";
    case "HIGH":
      return tr
        ? "Ödeme alınmadan ek kredi açmayın. Aktif sözleri yakından takip edin."
        : "Do not release additional credit without payment approval. Follow active promises closely.";
    case "MEDIUM":
      return f.overdueCount > 0
        ? tr
          ? "Gecikmiş faturalar için ödeme tarihi teyidi isteyin; kısa süreli takip planlayın."
          : "Ask for a confirmed payment date on overdue invoices; schedule a short follow-up."
        : tr
          ? "Standart takip yeterli; vade öncesi hatırlatmaları açık tutun."
          : "Standard follow-up is sufficient; keep pre-due reminders on.";
    default:
      return tr ? "Standart vade takibi yeterli." : "Standard due-date follow-up is sufficient.";
  }
}
