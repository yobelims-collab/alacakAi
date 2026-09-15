import type { Classification, Intent, Locale, Urgency } from "@/lib/types";
import { addDays, daysBetween } from "@/lib/domain/dates";
import { classificationOutputSchema, type ClassificationOutput } from "./schemas";
import { COLLECTION_SYSTEM_PROMPT } from "./system-prompt";

export interface ClassifierContext {
  asOf: string;
  language: Locale;
  invoiceNumber?: string;
  amount?: number;
  currency?: string;
  dueDate?: string;
}

type StructuredCaller = (system: string, user: string) => Promise<ClassificationOutput | null>;

const WEEKDAYS_EN = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAYS_TR = ["pazar", "pazartesi", "salı", "çarşamba", "perşembe", "cuma", "cumartesi"];
const MONTHS_EN = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTHS_TR = ["ocak", "şubat", "mart", "nisan", "mayıs", "haziran", "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık"];

/** Best-effort date extraction from free text, relative to `asOf`. Exported for tests. */
export function extractDate(text: string, asOf: string): string | null {
  const t = text.toLocaleLowerCase("tr");
  const iso = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = t.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;

  // "25 September", "25 Eylül", "September 25"
  for (const [months] of [[MONTHS_EN], [MONTHS_TR]] as const) {
    for (let m = 0; m < 12; m++) {
      const name = months[m];
      const a = t.match(new RegExp(`(\\d{1,2})\\s+${name}`));
      const b = t.match(new RegExp(`${name}\\s+(\\d{1,2})`));
      const day = a?.[1] ?? b?.[1];
      if (day) {
        const year = Number(asOf.slice(0, 4));
        let d = `${year}-${String(m + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
        if (daysBetween(asOf, d) < -30) d = `${year + 1}-${d.slice(5)}`;
        return d;
      }
    }
  }

  if (/\b(today|bugün)\b/.test(t)) return asOf;
  if (/\b(tomorrow|yarın)\b/.test(t)) return addDays(asOf, 1);
  if (/end of (the )?week|hafta sonuna kadar|bu hafta/.test(t)) return addDays(asOf, (5 - new Date(`${asOf}T00:00:00Z`).getUTCDay() + 7) % 7 || 7);
  if (/end of (the )?month|ay sonu(na kadar)?/.test(t)) {
    const d = new Date(`${asOf}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 1, 0);
    return d.toISOString().slice(0, 10);
  }
  const inDays = t.match(/(?:in|within)\s+(\d{1,3})\s+days?|(\d{1,3})\s+gün (?:içinde|sonra)/);
  if (inDays) return addDays(asOf, Number(inDays[1] ?? inDays[2]));
  const inWeeks = t.match(/(?:in|within)\s+(\d{1,2})\s+weeks?|(\d{1,2})\s+hafta (?:içinde|sonra)/);
  if (inWeeks) return addDays(asOf, 7 * Number(inWeeks[1] ?? inWeeks[2]));

  // Weekdays: "Friday" / "cuma" = the upcoming one; "next Friday" / "haftaya cuma" = that weekday of *next* week.
  for (const [names, nextWeek] of [
    [WEEKDAYS_EN, /\bnext\b/],
    [WEEKDAYS_TR, /haftaya|gelecek hafta|önümüzdeki hafta/],
  ] as const) {
    for (let i = 0; i < 7; i++) {
      if (new RegExp(`(^|[^a-zçğıöşü])${names[i]}([^a-zçğıöşü]|$)`).test(t)) {
        const dow = new Date(`${asOf}T00:00:00Z`).getUTCDay();
        if (nextWeek.test(t)) {
          const toNextMonday = (8 - dow) % 7 || 7;
          return addDays(asOf, toNextMonday + ((i - 1 + 7) % 7));
        }
        let delta = (i - dow + 7) % 7;
        if (delta === 0) delta = 7;
        return addDays(asOf, delta);
      }
    }
  }
  return null;
}

function extractExtensionDays(text: string): number | null {
  const t = text.toLocaleLowerCase("tr");
  const m = t.match(/(\d{1,3})\s*(?:more\s+)?(?:days?|gün)/);
  if (m) return Number(m[1]);
  const w = t.match(/(\d{1,2})\s*(?:more\s+)?(?:weeks?|hafta)/);
  if (w) return Number(w[1]) * 7;
  const mo = t.match(/(\d{1,2})\s*(?:more\s+)?(?:months?|ay)\b/);
  if (mo) return Number(mo[1]) * 30;
  return null;
}

function extractAmount(text: string): number | null {
  const m = text.match(/(?:€|\$|₺|eur|usd|try|tl)\s?([\d.,]+)|([\d.,]+)\s?(?:€|\$|₺|eur|usd|try|tl)/i);
  const raw = m?.[1] ?? m?.[2];
  if (!raw) return null;
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

interface Rule {
  intent: Intent;
  patterns: RegExp[];
  urgency: Urgency;
  confidence: number;
}

/** Ordered: the first matching rule wins, so more specific intents come first. */
const RULES: Rule[] = [
  { intent: "REFUSAL_TO_PAY", patterns: [/will not pay|won'?t pay|refuse|not going to pay|ödemeyeceğiz|ödemeyi reddediyoruz|ödemeyeceğim/], urgency: "HIGH", confidence: 0.85 },
  { intent: "WRONG_CONTACT", patterns: [/wrong (person|contact|department)|no longer work|not (the )?right (person|contact)|yanlış (kişi|muhatap|departman)|artık (burada )?çalışmıyor|ben ilgilenmiyorum/], urgency: "LOW", confidence: 0.85 },
  { intent: "DISPUTE", patterns: [/dispute|incorrect|wrong amount|overcharged|does not match|doesn'?t match|we disagree|itiraz|hatalı|yanlış tutar|fazla fatura|uyuşmuyor|mutabık değiliz/], urgency: "HIGH", confidence: 0.8 },
  { intent: "PRODUCT_OR_SHIPMENT_PROBLEM", patterns: [/shipment|delivery|damaged|missing items|defective|not (been )?delivered|quality|sevkiyat|teslimat|hasarlı|eksik (ürün|teslimat)|arızalı|kalite sorunu|ürün(ler)? gelmedi/], urgency: "HIGH", confidence: 0.8 },
  { intent: "INVOICE_NOT_RECEIVED", patterns: [/never received (the )?invoice|didn'?t receive (the )?invoice|no invoice|resend (the )?invoice|send (the )?invoice again|fatura(yı)? (bize )?(ulaşmadı|almadık|gelmedi)|faturayı tekrar/], urgency: "MEDIUM", confidence: 0.85 },
  { intent: "REQUEST_EXTENSION", patterns: [/extension|extend|more time|another \d+ days|additional \d+ days|\d+ more days|postpone|ek süre|erteleme|ertelemek|\d+ gün daha|vade uzat|uzatma/], urgency: "MEDIUM", confidence: 0.8 },
  { intent: "CASH_FLOW_PROBLEM", patterns: [/cash ?flow|liquidity|financial difficult|tight on cash|can'?t afford|nakit (akışı|sıkıntı)|likidite|finansal (zorluk|sıkıntı)|ödeme güçlüğü/], urgency: "HIGH", confidence: 0.8 },
  { intent: "WAITING_FOR_APPROVAL", patterns: [/waiting for (the )?approval|pending approval|needs? (to be )?approv|sign-?off|finance (department )?(is|will) (review|approv)|onay bekliyor|onaya sunuldu|onaylan(ması|masını) bekli|imza bekli|finans onayı/], urgency: "LOW", confidence: 0.8 },
  { intent: "PAYMENT_CONFIRMED", patterns: [/(has|have|was|were) (already )?(been )?(paid|transferred|sent|made)|payment (was|has been) (made|sent|completed)|we paid|already paid|ödeme(yi)? (yaptık|gönderdik|gerçekleştirdik)|ödendi|havale (yaptık|edildi|gönderildi)|hesabınıza (geçti|gönderildi)/], urgency: "LOW", confidence: 0.8 },
  { intent: "PAYMENT_DATE_PROMISED", patterns: [/will (be )?(pay|paid|transfer|process|settle)|we'?ll (pay|transfer|process)|payment (will|is) (be )?(scheduled|made|processed)|going to pay|plan to pay|ödeyeceğiz|ödeme yapılacak|ödeme yapacağız|havale edeceğiz|gönderilecek|ödenecek|ödemeyi .* (yapacağız|yapılacak|gerçekleştireceğiz)|planlıyoruz/], urgency: "LOW", confidence: 0.75 },
];

/** Deterministic classifier used when no model is configured (and as a sanity check). */
export function classifyWithRules(text: string, ctx: ClassifierContext): ClassificationOutput {
  const t = text.toLocaleLowerCase("tr");
  const date = extractDate(text, ctx.asOf);
  const ext = extractExtensionDays(text);
  const amt = extractAmount(text);

  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(t))) {
      let intent = rule.intent;
      let confidence = rule.confidence;
      if (intent === "PAYMENT_DATE_PROMISED" && date) confidence = 0.9;
      if (intent === "PAYMENT_DATE_PROMISED" && !date) confidence = 0.6;
      if (intent === "REQUEST_EXTENSION" && date && !ext) intent = "PAYMENT_DATE_PROMISED";
      return {
        intent,
        confidence,
        promised_date: intent === "PAYMENT_DATE_PROMISED" || intent === "WAITING_FOR_APPROVAL" ? date : null,
        requested_extension_days: intent === "REQUEST_EXTENSION" ? ext : null,
        disputed_amount: intent === "DISPUTE" ? amt : null,
        reason: intent === "PAYMENT_DATE_PROMISED" || intent === "PAYMENT_CONFIRMED" ? null : text.slice(0, 200),
        urgency: rule.urgency,
        summary: text.slice(0, 200),
      };
    }
  }
  // A bare date with no verb is most likely a promise ("Friday.", "25 Eylül").
  if (date && text.trim().length < 60) {
    return { intent: "PAYMENT_DATE_PROMISED", confidence: 0.55, promised_date: date, requested_extension_days: null, disputed_amount: null, reason: null, urgency: "LOW", summary: text.slice(0, 200) };
  }
  return { intent: "OTHER", confidence: 0.4, promised_date: null, requested_extension_days: null, disputed_amount: null, reason: text.slice(0, 200), urgency: "MEDIUM", summary: text.slice(0, 200) };
}

/**
 * Classifies a customer reply. Uses the model when available, validated with Zod; the
 * rule-based classifier is the fallback. Never mutates state — the collection service decides
 * what to do with the result (promises, escalations, etc.).
 */
export async function classifyReply(text: string, ctx: ClassifierContext, llm: StructuredCaller | null): Promise<Classification> {
  const rules = classifyWithRules(text, ctx);
  let out: ClassificationOutput = rules;
  let engine: Classification["engine"] = "rules";

  if (llm) {
    const user = [
      `Today is ${ctx.asOf}. The customer's language is ${ctx.language === "tr" ? "Turkish" : "English"}.`,
      ctx.invoiceNumber ? `Context: invoice ${ctx.invoiceNumber}, ${ctx.amount} ${ctx.currency}, due ${ctx.dueDate}.` : "",
      `Classify the customer's reply below into exactly one intent from: PAYMENT_CONFIRMED, PAYMENT_DATE_PROMISED, WAITING_FOR_APPROVAL, CASH_FLOW_PROBLEM, INVOICE_NOT_RECEIVED, DISPUTE, PRODUCT_OR_SHIPMENT_PROBLEM, REQUEST_EXTENSION, REFUSAL_TO_PAY, WRONG_CONTACT, OTHER.`,
      `Extract: promised_date (YYYY-MM-DD, resolve relative dates such as "next Friday" against today; null if none), requested_extension_days (integer or null), disputed_amount (number or null), reason (short, or null), urgency (LOW|MEDIUM|HIGH), summary (one sentence in English), confidence (0-1).`,
      `Return JSON only with keys: intent, confidence, promised_date, requested_extension_days, disputed_amount, reason, urgency, summary.`,
      `Customer reply:\n"""${text.slice(0, 3000)}"""`,
    ]
      .filter(Boolean)
      .join("\n");
    const result = await llm(COLLECTION_SYSTEM_PROMPT, user);
    const parsed = result ? classificationOutputSchema.safeParse(result) : null;
    if (parsed?.success) {
      out = parsed.data;
      engine = "llm";
      // Guard: a promised date must not be in the past by more than a day.
      if (out.promised_date && daysBetween(ctx.asOf, out.promised_date) < -1) out = { ...out, promised_date: null, confidence: Math.min(out.confidence, 0.6) };
    }
  }

  return {
    ...out,
    requires_human: false, // decided by escalation rules in the service layer
    engine,
  };
}
