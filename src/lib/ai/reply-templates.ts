import type { Intent, Locale } from "@/lib/types";
import { formatDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import type { TemplateFacts } from "./templates";

export interface ReplyDraft {
  subject: string;
  body: string;
}

export interface ReplyAlternatives {
  soft: ReplyDraft;
  firm: ReplyDraft;
}

function greeting(f: TemplateFacts, locale: Locale): string {
  if (locale === "tr") return f.contactName ? `Merhaba ${f.contactName},` : `Merhaba,`;
  return f.contactName ? `Dear ${f.contactName},` : `Hello,`;
}

function closing(f: TemplateFacts, locale: Locale): string {
  const sig = f.signature?.trim() || f.companyName;
  return locale === "tr" ? `Teşekkürler,\n${sig}` : `Kind regards,\n${sig}`;
}

/**
 * Reviewed reply drafts for each customer intent. The AI never sends these on its own:
 * they are attached to the inbox card so the human edits and sends in seconds.
 * `soft` is accommodating, `firm` is clear and direct; neither threatens or invents terms.
 */
export function renderReplyAlternatives(intent: Intent, f: TemplateFacts, locale: Locale, extra: { promisedDate?: string | null; extensionDays?: number | null } = {}): ReplyAlternatives {
  const tr = locale === "tr";
  const g = greeting(f, locale);
  const c = closing(f, locale);
  const money = formatMoney(f.amount, f.currency, locale);
  const due = formatDate(f.dueDate, locale);
  const promised = extra.promisedDate ? formatDate(extra.promisedDate, locale) : null;
  const subject = tr ? `Re: ${f.invoiceNumber} numaralı fatura` : `Re: Invoice ${f.invoiceNumber}`;
  const wrap = (soft: string, firm: string): ReplyAlternatives => ({ soft: { subject, body: `${g}\n\n${soft}\n\n${c}` }, firm: { subject, body: `${g}\n\n${firm}\n\n${c}` } });

  switch (intent) {
    case "PAYMENT_DATE_PROMISED":
      return wrap(
        tr ? `Bilgi için teşekkür ederiz. ${f.invoiceNumber} numaralı, ${money} tutarındaki fatura için ${promised ?? "belirttiğiniz tarihte"} ödeme yapılacağını not ettik. Ödeme sonrası dekontu paylaşırsanız seviniriz.` : `Thank you for the update. We have noted that invoice ${f.invoiceNumber} for ${money} will be paid on ${promised ?? "the date you indicated"}. Please share the remittance advice once the payment is made.`,
        tr ? `Bilgi için teşekkür ederiz. ${f.invoiceNumber} numaralı, ${money} tutarındaki fatura için ${promised ?? "belirttiğiniz tarih"} ödeme tarihi olarak kaydedildi. Bu tarihte ödemenin hesabımıza ulaşmasını bekliyoruz; gecikme olursa lütfen önceden bilgi verin.` : `Thank you for the update. ${promised ?? "The date you indicated"} has been recorded as the payment date for invoice ${f.invoiceNumber} (${money}). We expect the payment to reach our account on that date; please let us know in advance if anything changes.`,
      );
    case "WAITING_FOR_APPROVAL":
      return wrap(
        tr ? `Bilgi için teşekkürler. ${f.invoiceNumber} numaralı faturanın onay sürecinde olduğunu not ettik. Ödeme tarihi netleştiğinde bizimle paylaşmanızı rica ederiz.` : `Thanks for letting us know. We have noted that invoice ${f.invoiceNumber} is in your approval process. Please share the payment date once it is confirmed.`,
        tr ? `Bilgi için teşekkürler. ${f.invoiceNumber} numaralı faturanın vadesi ${due} tarihinde dolmuştur. Onay sürecinin tamamlanacağı tarihi ve kesin ödeme tarihini bu hafta içinde bizimle paylaşmanızı rica ederiz.` : `Thanks for letting us know. Invoice ${f.invoiceNumber} was due on ${due}. Please share the date your approval will be completed and a firm payment date within this week.`,
      );
    case "PAYMENT_CONFIRMED":
      return wrap(
        tr ? `Bilgi için teşekkür ederiz. ${f.invoiceNumber} numaralı faturanın ödemesini banka hareketlerimizde kontrol ediyoruz; dekontu paylaşırsanız eşleştirmeyi hızlandırabiliriz.` : `Thank you. We are checking our bank records for the payment of invoice ${f.invoiceNumber}; sharing the remittance advice would help us match it quickly.`,
        tr ? `Teşekkürler. ${f.invoiceNumber} numaralı fatura için ${money} tutarındaki ödeme henüz hesabımızda görünmüyor. Dekontu (tarih, tutar, gönderen banka) paylaşmanızı rica ederiz.` : `Thank you. The payment of ${money} for invoice ${f.invoiceNumber} is not visible in our account yet. Please send the remittance advice (date, amount, sending bank).`,
      );
    case "INVOICE_NOT_RECEIVED":
      return wrap(
        tr ? `Bilgi için teşekkürler. ${f.invoiceNumber} numaralı, ${money} tutarındaki faturayı bu e-posta ekinde yeniden gönderiyoruz. Ödeme planınızı bizimle paylaşabilir misiniz?` : `Thanks for letting us know. We are re-sending invoice ${f.invoiceNumber} for ${money} with this email. Could you share your payment plan for it?`,
        tr ? `${f.invoiceNumber} numaralı, ${money} tutarındaki fatura ${due} vadeli olup ekte yeniden gönderilmiştir. Ödeme tarihini bu hafta içinde teyit etmenizi rica ederiz.` : `Invoice ${f.invoiceNumber} for ${money}, due ${due}, is attached again. Please confirm the payment date within this week.`,
      );
    case "REQUEST_EXTENSION":
      return wrap(
        tr ? `Talebiniz için teşekkürler. ${f.invoiceNumber} numaralı fatura için ${extra.extensionDays ? `${extra.extensionDays} günlük` : "ek süre"} talebinizi değerlendiriyoruz ve en kısa sürede dönüş yapacağız.` : `Thank you for your request. We are reviewing your request for ${extra.extensionDays ? `a ${extra.extensionDays}-day extension` : "an extension"} on invoice ${f.invoiceNumber} and will get back to you shortly.`,
        tr ? `Talebiniz için teşekkürler. ${f.invoiceNumber} numaralı faturanın vadesi ${due} tarihinde dolmuştur; bu aşamada ek süre tanıyamıyoruz. Ödemeyi hangi tarihte yapabileceğinizi bizimle paylaşmanızı rica ederiz.` : `Thank you for your request. Invoice ${f.invoiceNumber} was due on ${due}; we are unable to grant an extension at this stage. Please let us know the date on which you can make the payment.`,
      );
    case "CASH_FLOW_PROBLEM":
      return wrap(
        tr ? `Durumu anlıyoruz. ${f.invoiceNumber} numaralı, ${money} tutarındaki fatura için birlikte bir ödeme planı oluşturmak isteriz. Sizin için uygun taksit tarihlerini paylaşabilir misiniz?` : `We understand. We would like to agree a payment plan for invoice ${f.invoiceNumber} (${money}). Could you share instalment dates that would work for you?`,
        tr ? `Bilgi için teşekkürler. ${f.invoiceNumber} numaralı, ${money} tutarındaki fatura ${due} tarihinden beri açıktır. Bu hafta içinde kesin bir ödeme planı bekliyoruz; plan gelene kadar yeni siparişleri bekletmek durumundayız.` : `Thank you for the information. Invoice ${f.invoiceNumber} (${money}) has been open since ${due}. We expect a firm payment plan within this week; until then we have to hold new orders.`,
      );
    case "DISPUTE":
      return wrap(
        tr ? `Bildiriminiz için teşekkürler. ${f.invoiceNumber} numaralı fatura ile ilgili itirazınızı inceliyoruz ve ilgili ekiple birlikte en kısa sürede dönüş yapacağız.` : `Thank you for flagging this. We are reviewing your dispute regarding invoice ${f.invoiceNumber} with the relevant team and will get back to you shortly.`,
        tr ? `Bildiriminiz için teşekkürler. ${f.invoiceNumber} numaralı faturaya ilişkin itirazınızı inceliyoruz. İtiraz edilen kalemler dışındaki tutarın vadesinde ödenmesini rica ederiz.` : `Thank you for flagging this. We are reviewing your dispute regarding invoice ${f.invoiceNumber}. Please settle the undisputed part of the amount by the due date.`,
      );
    case "PRODUCT_OR_SHIPMENT_PROBLEM":
      return wrap(
        tr ? `Bildiriminiz için teşekkürler; sevkiyatla ilgili sorunu operasyon ekibimize ilettik. Konu netleşene kadar ${f.invoiceNumber} numaralı fatura için takip mesajlarını bekletiyoruz.` : `Thank you for letting us know; we have passed the shipment issue to our operations team. Follow-ups on invoice ${f.invoiceNumber} are paused until it is resolved.`,
        tr ? `Bildiriminiz için teşekkürler. Sevkiyat konusunu inceliyoruz; sorun teyit edilene kadar ${f.invoiceNumber} numaralı faturanın sorunsuz teslim edilen kalemlerinin ödenmesini rica ederiz.` : `Thank you for letting us know. We are investigating the shipment issue; meanwhile please settle the items of invoice ${f.invoiceNumber} that were delivered correctly.`,
      );
    case "REFUSAL_TO_PAY":
      return wrap(
        tr ? `Mesajınızı aldık. ${f.invoiceNumber} numaralı fatura ile ilgili görüşmek üzere hesap yöneticimiz sizinle iletişime geçecektir.` : `We have received your message. Your account manager will contact you to discuss invoice ${f.invoiceNumber}.`,
        tr ? `Mesajınızı aldık. ${f.invoiceNumber} numaralı, ${money} tutarındaki fatura teslim edilen ürünlere aittir ve ödenmesi gerekmektedir. Hesap yöneticimiz konuyu görüşmek üzere sizinle iletişime geçecektir.` : `We have received your message. Invoice ${f.invoiceNumber} for ${money} relates to delivered goods and remains payable. Your account manager will contact you to discuss it.`,
      );
    case "WRONG_CONTACT":
      return wrap(
        tr ? `Bilgi için teşekkürler. ${f.invoiceNumber} numaralı fatura için doğru muhatabın adını ve e-posta adresini paylaşabilir misiniz?` : `Thanks for letting us know. Could you share the name and email of the right contact for invoice ${f.invoiceNumber}?`,
        tr ? `Bilgi için teşekkürler. ${f.invoiceNumber} numaralı faturanın ödemesinden sorumlu kişinin iletişim bilgilerini bugün içinde paylaşmanızı rica ederiz.` : `Thanks for letting us know. Please share the contact details of the person responsible for paying invoice ${f.invoiceNumber} today.`,
      );
    default:
      return wrap(
        tr ? `Mesajınız için teşekkürler. ${f.invoiceNumber} numaralı, ${money} tutarındaki fatura ile ilgili size nasıl yardımcı olabiliriz?` : `Thank you for your message. How can we help regarding invoice ${f.invoiceNumber} for ${money}?`,
        tr ? `Mesajınız için teşekkürler. ${f.invoiceNumber} numaralı, ${money} tutarındaki faturanın ödeme tarihini teyit etmenizi rica ederiz.` : `Thank you for your message. Please confirm the payment date for invoice ${f.invoiceNumber} (${money}).`,
      );
  }
}

/** Drafts attached to a 30+ day escalation card: soft = account-manager handover, firm = shipments on hold until a plan. */
export function renderEscalationAlternatives(f: TemplateFacts, locale: Locale): ReplyAlternatives {
  const tr = locale === "tr";
  const g = greeting(f, locale);
  const c = closing(f, locale);
  const money = formatMoney(f.amount, f.currency, locale);
  const subject = tr ? `${f.invoiceNumber} numaralı fatura – ödeme planı` : `Invoice ${f.invoiceNumber} – payment plan`;
  return {
    soft: { subject, body: `${g}\n\n${tr ? `${money} tutarındaki ${f.invoiceNumber} numaralı faturamız ${f.daysOverdue} gündür ödenmemiştir. Konuyu hesap yöneticimize ilettik; kendisi sizinle bir ödeme planı görüşmek üzere iletişime geçecektir. Ödeme yapıldıysa dekontu paylaşmanızı rica ederiz.` : `Invoice ${f.invoiceNumber} for ${money} has been outstanding for ${f.daysOverdue} days. We have passed the matter to your account manager, who will contact you to agree a payment plan. If the payment has already been made, please share the remittance advice.`}\n\n${c}` },
    firm: { subject, body: `${g}\n\n${tr ? `${money} tutarındaki ${f.invoiceNumber} numaralı faturamız ${f.daysOverdue} gündür ödenmemiş ve hatırlatmalarımız yanıtsız kalmıştır. Bu hafta içinde kesin bir ödeme planı bekliyoruz; plan alınana kadar yeni sevkiyatları bekletmek durumundayız.` : `Invoice ${f.invoiceNumber} for ${money} has been outstanding for ${f.daysOverdue} days and our reminders have gone unanswered. We expect a firm payment plan within this week; until then we have to hold new shipments.`}\n\n${c}` },
  };
}
