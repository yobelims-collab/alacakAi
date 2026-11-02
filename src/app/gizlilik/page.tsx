import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { LogoLink } from "@/components/app/logo";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export const metadata = { title: "Gizlilik ve KVKK Aydınlatma Metni — Alacore" };

/**
 * KVKK (6698 sayılı Kanun) aydınlatma metni TEMPLATE. Bracketed fields are placeholders the company
 * must fill in, and the whole text must be reviewed by a lawyer before the service is offered publicly.
 */
type Section = { h: string; p?: string[]; li?: string[] };
const COPY: Record<Locale, { title: string; updated: string; draft: string; back: string; sections: Section[] }> = {
  tr: {
    title: "Gizlilik ve KVKK Aydınlatma Metni",
    updated: "Son güncelleme: [tarih]",
    draft: "Taslak metin: köşeli parantez içindeki alanlar doldurulmalı ve metin yayına alınmadan önce bir hukukçu tarafından gözden geçirilmelidir.",
    back: "Ana sayfaya dön",
    sections: [
      {
        h: "1. Veri sorumlusu",
        p: [
          "Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (\"KVKK\") m. 10 uyarınca [Şirket unvanı] (\"Alacore\"; MERSİS: [numara]; adres: [adres]; KEP: [KEP adresi]) tarafından hazırlanmıştır.",
          "Alacore'u kullanan şirketlerin (\"Müşteri\") sisteme yüklediği kendi müşterilerine ve yetkililerine ait verilerde veri sorumlusu Müşteri'dir; Alacore bu verileri Müşteri adına ve talimatıyla işleyen veri işleyendir. Bu ilişki ayrıca bir veri işleme sözleşmesi ile düzenlenir.",
        ],
      },
      {
        h: "2. İşlenen kişisel veriler",
        li: [
          "Hesap verileri: ad soyad, e-posta, şifre (yalnızca şifrelenmiş özet), rol, şirket adı.",
          "Müşteri'nin yüklediği veriler: borçlu firma unvanı, vergi numarası, yetkili kişi adı, e-posta ve telefon numaraları, fatura ve ödeme bilgileri, banka hareketleri.",
          "İletişim verileri: gönderilen hatırlatmalar ve müşterilerden gelen yanıtların içeriği.",
          "İşlem güvenliği verileri: IP adresi, oturum ve işlem kayıtları.",
        ],
      },
      {
        h: "3. İşleme amaçları ve hukuki sebepler",
        li: [
          "Hizmet sözleşmesinin kurulması ve ifası: hesap açma, fatura takibi, hatırlatma gönderimi (KVKK m. 5/2-c).",
          "Hukuki yükümlülüklerin yerine getirilmesi: kayıtların saklanması, yetkili mercilere bilgi verilmesi (m. 5/2-ç).",
          "Meşru menfaat: hizmetin güvenliği, kötüye kullanımın önlenmesi, hata ayıklama (m. 5/2-f).",
          "Müşteri adına işlenen verilerde amaç ve hukuki sebep, veri sorumlusu olarak Müşteri tarafından belirlenir.",
        ],
      },
      {
        h: "4. Yapay zekâ kullanımı",
        p: [
          "Hatırlatma taslakları ve gelen yanıtların sınıflandırılması için, Müşteri etkinleştirdiyse, yapay zekâ hizmet sağlayıcısına (OpenAI) yalnızca ilgili mesaj ve fatura özeti gönderilir. Alacore otomatik olarak yalnızca vadesi yaklaşan faturalar için hatırlatma gönderir; diğer tüm mesajlar bir çalışanın onayından geçer. Yapay zekâ çıktıları kişi hakkında hukuki sonuç doğuran tek başına bir karar için kullanılmaz.",
        ],
      },
      {
        h: "5. Aktarım ve yurt dışı aktarım",
        p: ["Veriler, hizmetin sunulması için gerekli olduğu ölçüde aşağıdaki hizmet sağlayıcılarına aktarılır. Bu sağlayıcıların sunucuları yurt dışında bulunabilir; yurt dışı aktarımlar KVKK m. 9 kapsamındaki güvencelere (ör. standart sözleşme) dayanılarak yapılır."],
        li: [
          "Supabase — veritabanı, kimlik doğrulama ve dosya depolama ([bölge]).",
          "Vercel — uygulama barındırma.",
          "Resend — e-posta gönderimi ve gelen e-postaların alınması.",
          "OpenAI — yapay zekâ ile taslak oluşturma (Müşteri etkinleştirdiyse).",
          "Meta (WhatsApp Business) — WhatsApp mesajları (Müşteri etkinleştirdiyse).",
        ],
      },
      {
        h: "6. Saklama süresi",
        p: ["Hesap verileri sözleşme süresince ve sona ermesinden sonra yasal zamanaşımı süreleri boyunca ([süre]) saklanır. Müşteri'nin yüklediği veriler, Müşteri'nin talimatı veya sözleşmenin sona ermesiyle [süre] içinde silinir ya da anonim hale getirilir."],
      },
      {
        h: "7. İlgili kişinin hakları (KVKK m. 11)",
        li: [
          "Kişisel verilerinizin işlenip işlenmediğini öğrenme ve işlenmişse bilgi talep etme,",
          "işlenme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme,",
          "yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,",
          "eksik veya yanlış işlenmişse düzeltilmesini, şartları oluştuğunda silinmesini veya yok edilmesini isteme ve bu işlemlerin aktarılan üçüncü kişilere bildirilmesini isteme,",
          "münhasıran otomatik sistemlerle analiz sonucu aleyhinize bir sonuca itiraz etme,",
          "kanuna aykırı işleme nedeniyle zarara uğramanız halinde zararın giderilmesini talep etme.",
        ],
      },
      {
        h: "8. Başvuru",
        p: [
          "Başvurularınızı [e-posta adresi] adresine veya [KEP adresi] KEP adresine, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'e uygun olarak iletebilirsiniz. Başvurular en geç 30 gün içinde ücretsiz olarak sonuçlandırılır.",
          "Bir Alacore Müşterisi'nin borçlusu veya yetkilisi iseniz, verileriniz o şirket adına işlendiği için başvurunuzu öncelikle ilgili şirkete yapmanız gerekir; Alacore bu başvurunun yanıtlanmasında şirkete destek olur.",
        ],
      },
    ],
  },
  en: {
    title: "Privacy and KVKK Information Notice",
    updated: "Last updated: [date]",
    draft: "Draft text: fields in square brackets must be completed and the text must be reviewed by a lawyer before publication. The Turkish version prevails.",
    back: "Back to home",
    sections: [
      {
        h: "1. Data controller",
        p: [
          "This notice is provided under Article 10 of Turkish Law No. 6698 on the Protection of Personal Data (\"KVKK\") by [Company name] (\"Alacore\"; MERSIS: [number]; address: [address]; KEP: [KEP address]).",
          "For data that companies using Alacore (\"Customers\") upload about their own debtors and contacts, the Customer is the data controller and Alacore is a data processor acting on the Customer's instructions, under a separate data processing agreement.",
        ],
      },
      {
        h: "2. Personal data we process",
        li: [
          "Account data: name, email, password (hashed only), role, company name.",
          "Data uploaded by Customers: debtor company name, tax number, contact names, emails and phone numbers, invoice and payment data, bank transactions.",
          "Communication data: reminders sent and the content of replies received.",
          "Security data: IP address, session and activity logs.",
        ],
      },
      {
        h: "3. Purposes and legal bases",
        li: [
          "Entering into and performing the service contract: accounts, invoice tracking, sending reminders (KVKK Art. 5/2-c).",
          "Compliance with legal obligations: record keeping, responding to authorities (Art. 5/2-ç).",
          "Legitimate interest: service security, abuse prevention, debugging (Art. 5/2-f).",
          "For data processed on a Customer's behalf, the purpose and legal basis are determined by the Customer as controller.",
        ],
      },
      {
        h: "4. Use of AI",
        p: [
          "If the Customer enables it, only the relevant message and an invoice summary are sent to the AI provider (OpenAI) to draft reminders and classify replies. Alacore sends automatically only pre-due reminders; every other message is approved by an employee. AI output is never the sole basis of a decision with legal effect on a person.",
        ],
      },
      {
        h: "5. Transfers, including abroad",
        p: ["Data is shared with the following providers only as needed to run the service. Their servers may be located outside Turkey; such transfers rely on the safeguards of KVKK Art. 9 (e.g. standard contracts)."],
        li: [
          "Supabase — database, authentication and file storage ([region]).",
          "Vercel — application hosting.",
          "Resend — sending and receiving email.",
          "OpenAI — AI drafting (if enabled by the Customer).",
          "Meta (WhatsApp Business) — WhatsApp messages (if enabled by the Customer).",
        ],
      },
      {
        h: "6. Retention",
        p: ["Account data is kept for the term of the contract and afterwards for statutory limitation periods ([period]). Customer-uploaded data is deleted or anonymised within [period] of the Customer's instruction or the end of the contract."],
      },
      {
        h: "7. Your rights (KVKK Art. 11)",
        li: [
          "Learn whether your data is processed and request information about it,",
          "learn the purpose of processing and whether data is used accordingly,",
          "know the third parties, in Turkey or abroad, to whom data is transferred,",
          "request correction, deletion or destruction, and notification of these to recipients,",
          "object to an adverse outcome resulting exclusively from automated analysis,",
          "claim compensation for damage caused by unlawful processing.",
        ],
      },
      {
        h: "8. How to apply",
        p: [
          "Send requests to [email address] or to our KEP address [KEP address]. Requests are answered free of charge within 30 days.",
          "If you are a debtor or contact of an Alacore Customer, your data is processed on that company's behalf, so please contact that company first; Alacore assists it in responding.",
        ],
      },
    ],
  },
};

export default async function PrivacyPage() {
  const { locale } = await getT();
  const c = COPY[locale];
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <LogoLink />
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">{c.back}</Link>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{c.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{c.updated}</p>
        <p className="mt-6 flex gap-2 rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {c.draft}
        </p>
        {c.sections.map((s) => (
          <section key={s.h} className="mt-8">
            <h2 className="text-lg font-semibold">{s.h}</h2>
            {s.p?.map((para) => <p key={para.slice(0, 40)} className="mt-3 text-sm leading-relaxed text-foreground/85">{para}</p>)}
            {s.li && (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground/85">
                {s.li.map((item) => <li key={item.slice(0, 40)}>{item}</li>)}
              </ul>
            )}
          </section>
        ))}
      </article>
    </main>
  );
}
