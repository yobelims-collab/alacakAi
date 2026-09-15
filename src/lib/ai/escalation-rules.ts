import type { Classification, Locale } from "@/lib/types";

export interface EscalationContext {
  confidenceThreshold: number;
  /** Extension requests at/above this many days always go to a human. */
  largeExtensionDays?: number;
  brokenPromiseCount?: number;
  locale?: Locale;
  rawText?: string;
}

export interface EscalationDecision {
  escalate: boolean;
  reasons: string[];
  recommendedAction: string | null;
  severity: "WARNING" | "CRITICAL";
}

const LEGAL_THREAT = /lawyer|attorney|legal action|sue|court|lawsuit|avukat|dava|mahkeme|hukuki|icra|yasal/i;
const DISCOUNT = /discount|reduce the (amount|invoice)|write off|indirim|iskonto|tutarı düşür/i;
const CREDIT_INCREASE = /credit (limit|increase)|increase (our|the) limit|more credit|kredi limiti|limit artır|limitimizi/i;

/**
 * The AI must know when NOT to act. Pure function: maps a classification (+ context) to an
 * escalation decision with human-readable reasons and a recommended action for the operator.
 */
export function evaluateEscalation(c: Classification, ctx: EscalationContext): EscalationDecision {
  const tr = (ctx.locale ?? "tr") === "tr";
  const reasons: string[] = [];
  let recommended: string | null = null;
  let severity: EscalationDecision["severity"] = "WARNING";
  const text = ctx.rawText ?? "";
  const largeExt = ctx.largeExtensionDays ?? 14;

  if (c.intent === "DISPUTE") {
    reasons.push(tr ? "Müşteri faturaya itiraz ediyor" : "Customer disputes the invoice");
    recommended = tr ? "Fatura kalemlerini ve sevkiyat belgelerini kontrol edip müşteriyle mutabakat yapın." : "Verify invoice lines and delivery documents, then reconcile with the customer.";
    severity = "CRITICAL";
  }
  if (c.intent === "REFUSAL_TO_PAY") {
    reasons.push(tr ? "Müşteri ödemeyi reddediyor" : "Customer refuses to pay");
    recommended = tr ? "Hesap yöneticisi doğrudan görüşmeli; sevkiyatları durdurmayı değerlendirin." : "Account manager should call directly; consider holding further shipments.";
    severity = "CRITICAL";
  }
  if (c.intent === "PRODUCT_OR_SHIPMENT_PROBLEM") {
    reasons.push(tr ? "Ürün / sevkiyat sorunu bildirildi" : "Product or shipment problem reported");
    recommended = tr ? "Operasyon ekibiyle sevkiyatı doğrulayın; sorun çözülmeden hatırlatma göndermeyin." : "Confirm the shipment with operations; pause reminders until the issue is resolved.";
  }
  if (c.intent === "REQUEST_EXTENSION") {
    const days = c.requested_extension_days ?? 0;
    if (days >= largeExt || days === 0) {
      reasons.push(tr ? `Müşteri ${days ? `${days} günlük` : "belirsiz süreli"} ek süre istiyor` : `Customer requests a ${days ? `${days}-day` : "unspecified"} extension`);
      recommended = tr ? "Ek süreyi onaylamadan önce kredi riskini (açık bakiye, geçmiş sözler) gözden geçirin." : "Review credit exposure before approving the extension.";
    } else {
      reasons.push(tr ? `Kısa ek süre talebi (${days} gün)` : `Short extension request (${days} days)`);
      recommended = tr ? "Kısa ek süreyi onaylayabilir veya kesin tarih isteyebilirsiniz." : "You can approve the short extension or ask for a firm date.";
    }
  }
  if (c.intent === "CASH_FLOW_PROBLEM") {
    reasons.push(tr ? "Müşteri nakit akışı sorunu bildiriyor" : "Customer reports a cash-flow problem");
    recommended = tr ? "Taksitli ödeme planı önermeyi değerlendirin; yeni sevkiyatı ödeme planına bağlayın." : "Consider proposing an instalment plan; tie new shipments to the plan.";
  }
  if (LEGAL_THREAT.test(text)) {
    reasons.push(tr ? "Yasal süreç ifadesi geçiyor" : "Legal language detected");
    recommended = tr ? "Yönetim / hukuk ekibi devreye girmeli; AI iletişimi durduruldu." : "Management / legal should take over; AI communication paused.";
    severity = "CRITICAL";
  }
  if (DISCOUNT.test(text)) {
    reasons.push(tr ? "Müşteri indirim istiyor" : "Customer asks for a discount");
    recommended ??= tr ? "İndirim yetkisi satış yönetimindedir; AI indirim veremez." : "Discounts are a sales-management decision; the AI cannot grant them.";
  }
  if (CREDIT_INCREASE.test(text)) {
    reasons.push(tr ? "Müşteri kredi limiti artışı istiyor" : "Customer requests a credit increase");
    recommended ??= tr ? "Kredi limitini ödeme geçmişi ve risk skoruna göre değerlendirin." : "Assess the credit limit against payment history and risk score.";
  }
  if (c.intent === "WRONG_CONTACT") {
    reasons.push(tr ? "Muhatap yanlış; doğru kişi bulunmalı" : "Wrong contact; correct person needed");
    recommended = tr ? "Müşteri kaydındaki ilgili kişiyi güncelleyin." : "Update the contact person on the customer record.";
  }
  if ((ctx.brokenPromiseCount ?? 0) > 0 && (c.intent === "PAYMENT_DATE_PROMISED" || c.intent === "WAITING_FOR_APPROVAL")) {
    reasons.push(tr ? `Daha önce ${ctx.brokenPromiseCount} söz tutulmadı` : `${ctx.brokenPromiseCount} previous promise${ctx.brokenPromiseCount! > 1 ? "s" : ""} broken`);
    recommended ??= tr ? "Yeni sözü kabul etmeden önce hesap yöneticisi teyit almalı." : "Have the account manager confirm before accepting a new promise.";
  }
  if (c.confidence < ctx.confidenceThreshold) {
    reasons.push(tr ? `AI güveni düşük (${Math.round(c.confidence * 100)}%)` : `AI confidence is low (${Math.round(c.confidence * 100)}%)`);
    recommended ??= tr ? "Mesajı okuyup sınıflandırmayı elle doğrulayın." : "Read the message and confirm the classification manually.";
  }
  if (c.intent === "OTHER" && reasons.length === 0) {
    reasons.push(tr ? "Yanıt bilinen kategorilere uymuyor" : "Reply does not fit a known category");
    recommended = tr ? "Mesajı inceleyip uygun yanıtı seçin." : "Review the message and choose the appropriate reply.";
  }

  return { escalate: reasons.length > 0, reasons, recommendedAction: recommended, severity };
}
