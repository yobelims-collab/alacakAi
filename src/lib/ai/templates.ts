import type { CollectionStage, Currency, Locale, Tone } from "@/lib/types";
import { formatDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";

export interface TemplateFacts {
  contactName: string | null;
  customerName: string;
  companyName: string;
  invoiceNumber: string;
  amount: number;
  currency: Currency;
  dueDate: string;
  daysOverdue: number;
  promisedDate?: string | null;
  signature?: string | null;
}

export function defaultToneForStage(stage: CollectionStage): Tone {
  switch (stage) {
    case "PRE_DUE":
    case "DUE_TODAY":
      return "POLITE";
    case "OVERDUE_EARLY":
      return "PROFESSIONAL";
    default:
      return "FIRM";
  }
}

function greeting(f: TemplateFacts, locale: Locale): string {
  if (locale === "tr") return f.contactName ? `Merhaba ${f.contactName},` : `Merhaba ${f.customerName} yetkilisi,`;
  return f.contactName ? `Dear ${f.contactName},` : `Dear ${f.customerName} team,`;
}

function closing(f: TemplateFacts, locale: Locale): string {
  const sig = f.signature?.trim() || f.companyName;
  return locale === "tr" ? `Teşekkürler,\n${sig}` : `Kind regards,\n${sig}`;
}

/**
 * Deterministic, reviewed message templates per stage × language. These are the fallback when
 * no model is configured and the "anchor" the model output is checked against (facts must match).
 */
export function renderTemplate(stage: CollectionStage, tone: Tone, f: TemplateFacts, locale: Locale): { subject: string; body: string } {
  const money = formatMoney(f.amount, f.currency, locale);
  const due = formatDate(f.dueDate, locale);
  const g = greeting(f, locale);
  const c = closing(f, locale);
  const tr = locale === "tr";

  switch (stage) {
    case "PRE_DUE":
      return tr
        ? {
            subject: `${f.invoiceNumber} numaralı fatura – vade hatırlatması`,
            body: `${g}\n\n${due} vadeli, ${money} tutarındaki ${f.invoiceNumber} numaralı faturamızın ödeme tarihinin yaklaştığını hatırlatmak isteriz.\n\nHerhangi bir konuda desteğe ihtiyacınız olursa bizimle iletişime geçebilirsiniz.\n\n${c}`,
          }
        : {
            subject: `Invoice ${f.invoiceNumber} – upcoming due date`,
            body: `${g}\n\nThis is a friendly reminder that invoice ${f.invoiceNumber} for ${money} is due on ${due}.\n\nIf you need anything from our side to process the payment, please let us know.\n\n${c}`,
          };
    case "DUE_TODAY":
      return tr
        ? {
            subject: `${f.invoiceNumber} numaralı fatura bugün vadesi doluyor`,
            body: `${g}\n\n${money} tutarındaki ${f.invoiceNumber} numaralı faturamızın vadesi bugün (${due}) dolmaktadır.\n\nÖdemenin planlandığı tarihi bizimle paylaşabilir misiniz? Ödeme yapıldıysa bu mesajı dikkate almayınız.\n\n${c}`,
          }
        : {
            subject: `Invoice ${f.invoiceNumber} is due today`,
            body: `${g}\n\nInvoice ${f.invoiceNumber} for ${money} is due today (${due}).\n\nCould you confirm the date on which the payment is scheduled? If it has already been made, please disregard this message.\n\n${c}`,
          };
    case "OVERDUE_EARLY":
      return tr
        ? {
            subject: `${f.invoiceNumber} numaralı fatura – ödeme hatırlatması`,
            body: `${g}\n\nKayıtlarımıza göre ${due} vadeli, ${money} tutarındaki ${f.invoiceNumber} numaralı faturamızın ödemesi henüz tarafımıza ulaşmamıştır (${f.daysOverdue} gün).\n\nÖdemeyi hangi tarihte yapmayı planladığınızı bizimle paylaşırsanız memnun oluruz. Ödeme yapıldıysa dekontu iletmenizi rica ederiz.\n\n${c}`,
          }
        : {
            subject: `Invoice ${f.invoiceNumber} – payment reminder`,
            body: `${g}\n\nAccording to our records, invoice ${f.invoiceNumber} for ${money}, due on ${due}, has not been settled yet (${f.daysOverdue} days).\n\nWe would appreciate it if you could let us know the date on which you plan to make the payment. If it has already been made, please share the remittance advice.\n\n${c}`,
          };
    case "OVERDUE_MID":
      return tr
        ? {
            subject: `${f.invoiceNumber} numaralı fatura – ödeme tarihi teyidi`,
            body: `${g}\n\n${money} tutarındaki ${f.invoiceNumber} numaralı faturamızın vadesi ${due} tarihinde dolmuş olup ödeme ${f.daysOverdue} gündür beklemektedir.\n\nKesin ödeme tarihini bugün içinde teyit etmenizi rica ederiz. Ödemeyi engelleyen bir sorun varsa lütfen bize bildirin; birlikte çözüm bulalım.\n\n${c}`,
          }
        : {
            subject: `Invoice ${f.invoiceNumber} – please confirm payment date`,
            body: `${g}\n\nInvoice ${f.invoiceNumber} for ${money} was due on ${due} and has now been outstanding for ${f.daysOverdue} days.\n\nPlease confirm a firm payment date by the end of today. If something is blocking the payment, let us know so we can resolve it together.\n\n${c}`,
          };
    case "ESCALATED":
      return tr
        ? {
            subject: `${f.invoiceNumber} numaralı fatura – hesap yöneticisi görüşmesi`,
            body: `${g}\n\n${money} tutarındaki ${f.invoiceNumber} numaralı faturamız ${f.daysOverdue} gündür ödenmemiştir. Konuyu hesap yöneticimize ilettik; kendisi ödeme planını görüşmek üzere sizinle iletişime geçecektir.\n\nBu arada ödeme yapıldıysa dekontu bizimle paylaşmanızı rica ederiz.\n\n${c}`,
          }
        : {
            subject: `Invoice ${f.invoiceNumber} – account manager follow-up`,
            body: `${g}\n\nInvoice ${f.invoiceNumber} for ${money} has been outstanding for ${f.daysOverdue} days. We have passed the matter to your account manager, who will contact you to agree on a payment plan.\n\nIf the payment has already been made in the meantime, please share the remittance advice.\n\n${c}`,
          };
    default:
      return tr
        ? {
            subject: `${f.invoiceNumber} numaralı fatura hakkında`,
            body: `${g}\n\n${money} tutarındaki ${f.invoiceNumber} numaralı faturamızla ilgili sizinle iletişime geçmek istedik.\n\n${c}`,
          }
        : {
            subject: `Regarding invoice ${f.invoiceNumber}`,
            body: `${g}\n\nWe wanted to get in touch regarding invoice ${f.invoiceNumber} for ${money}.\n\n${c}`,
          };
  }
}

/** Follow-up sent on the promised date when no payment has been matched yet. */
export function renderPromiseFollowUp(f: TemplateFacts, locale: Locale): { subject: string; body: string } {
  const money = formatMoney(f.amount, f.currency, locale);
  const promised = formatDate(f.promisedDate ?? f.dueDate, locale);
  const g = greeting(f, locale);
  const c = closing(f, locale);
  return locale === "tr"
    ? {
        subject: `${f.invoiceNumber} numaralı fatura – ${promised} tarihli ödeme`,
        body: `${g}\n\n${f.invoiceNumber} numaralı, ${money} tutarındaki fatura için ${promised} tarihinde ödeme yapılacağını belirtmiştiniz. Ödeme henüz hesabımıza yansımadı.\n\nÖdeme yapıldıysa dekontu paylaşmanızı, yapılmadıysa yeni tarihi bildirmenizi rica ederiz.\n\n${c}`,
      }
    : {
        subject: `Invoice ${f.invoiceNumber} – payment expected on ${promised}`,
        body: `${g}\n\nYou indicated that invoice ${f.invoiceNumber} for ${money} would be paid on ${promised}. The payment has not reached our account yet.\n\nIf it has been made, please share the remittance advice; otherwise, please let us know the new date.\n\n${c}`,
      };
}
