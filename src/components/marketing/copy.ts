import type { Grade, Locale } from "@/lib/types";

export type StatKind = "money" | "percent" | "count";
export type FeedTone = "info" | "warning" | "success";
export type RowStatus = "sent" | "pending" | "decision";

export interface PreviewStat {
  label: string;
  value: number;
  kind: StatKind;
}

export interface PreviewRow {
  grade: Grade;
  customer: string;
  amount: string;
  overdue: string;
  status: RowStatus;
}

export interface LandingCopy {
  meta: { title: string; description: string };
  nav: { how: string; features: string; pricing: string; faq: string; signIn: string; start: string; inbox: string };
  hero: { badge: string; headline: string; accent: string; sub: string; demo: string; start: string; note: string };
  preview: {
    title: string;
    demo: string;
    dataNote: string;
    stats: PreviewStat[];
    inboxTitle: string;
    rows: PreviewRow[];
    status: Record<RowStatus, string>;
    feedTitle: string;
    feed: { text: string; tone: FeedTone }[];
  };
  facts: string[];
  how: { title: string; sub: string; steps: { title: string; body: string }[]; flow: { sources: string[]; engine: string; outputs: string[] } };
  ai: {
    badge: string;
    title: string;
    body: string;
    points: string[];
    card: {
      header: string;
      customer: string;
      grade: Grade;
      amount: string;
      overdue: string;
      messageLabel: string;
      message: string;
      draftLabel: string;
      tabs: [string, string];
      drafts: [string, string];
      extend: string;
      hold: string;
      send: string;
    };
  };
  features: { title: string; sub: string; items: { title: string; body: string }[] };
  grades: {
    title: string;
    sub: string;
    letters: Record<Grade, string>;
    card: { customer: string; grade: Grade; label: string; factsLabel: string; facts: string[]; ruleLabel: string; rule: string; disclaimer: string };
  };
  pricing: { title: string; sub: string; note: string };
  faq: { title: string; sub: string; items: { q: string; a: string }[] };
  cta: { title: string; sub: string; demo: string; start: string };
  footer: { tagline: string; signIn: string; signUp: string; privacy: string; rights: string };
}

const tr: LandingCopy = {
  meta: {
    title: "Alacore — Yapay zekâ destekli B2B tahsilat asistanı",
    description: "Alacore, vadesi gelen ve geciken B2B faturalarınızı takip eder, müşterilerinizle iletişim kurar ve ödeme süreçlerini sizin için yönetir.",
  },
  nav: { how: "Nasıl çalışır", features: "Özellikler", pricing: "Fiyatlandırma", faq: "SSS", signIn: "Giriş yap", start: "Ücretsiz Başla", inbox: "Gelen Kutusu" },
  hero: {
    badge: "AI destekli tahsilat",
    headline: "Paranızı almak için müşterilerinizi takip etmek zorunda kalmayın.",
    accent: "zorunda kalmayın.",
    sub: "Alacore, vadesi gelen ve geciken B2B faturalarınızı takip eder, müşterilerinizle iletişim kurar ve ödeme süreçlerini sizin için yönetir.",
    demo: "Demo'yu Gör",
    start: "Ücretsiz Başla",
    note: "Kredi kartı gerekmez · 2 dakikada demo",
  },
  preview: {
    title: "Tahsilat Özeti",
    demo: "Demo",
    dataNote: "Demo veri",
    stats: [
      { label: "Toplam Alacak", value: 4_280_000, kind: "money" },
      { label: "AI ile tahsil edilen", value: 1_240_000, kind: "money" },
      { label: "Tahsilat oranı", value: 91.4, kind: "percent" },
      { label: "Gecikmiş hesap", value: 124, kind: "count" },
    ],
    inboxTitle: "AI Gelen Kutusu",
    rows: [
      { grade: "A", customer: "Kuzey Gıda", amount: "₺86.400", overdue: "Vadeye 2 gün", status: "sent" },
      { grade: "C", customer: "Marmara Yapı", amount: "₺142.300", overdue: "9 gün gecikme", status: "pending" },
      { grade: "D", customer: "ABC Teknoloji", amount: "€18.500", overdue: "12 gün gecikme", status: "decision" },
    ],
    status: { sent: "Otomatik gönderildi", pending: "Onay bekliyor", decision: "Karar gerekli" },
    feedTitle: "AI etkinlik",
    feed: [
      { text: "AI hatırlatma gönderdi · Kuzey Gıda · 2 dk önce", tone: "info" },
      { text: "Ödeme sözü alındı · Marmara Yapı · 14 dk önce", tone: "warning" },
      { text: "₺8.420 ödeme eşleştirildi · Çukurova Tarım · 41 dk önce", tone: "success" },
    ],
  },
  facts: ["Vade öncesi hatırlatmalar otomatik", "Vade sonrası her mesaj insan onayıyla", "Müşteri derecesi A–E"],
  how: {
    flow: { sources: ["ERP / CSV", "e-Fatura", "Banka"], engine: "Alacore AI", outputs: ["E-posta", "WhatsApp", "Onay kutusu"] },
    title: "Nasıl çalışır",
    sub: "Dört adım; kararlar her adımda sizde.",
    steps: [
      { title: "Faturalarınızı bağlayın", body: "CSV yükleyin veya e-Fatura'dan aktarın. Müşteriler otomatik oluşturulur." },
      { title: "AI geciken hesapları tespit eder", body: "Vadeleri izler; gecikmeleri, tutulmayan sözleri ve riskli hesapları öne çıkarır." },
      { title: "AI müşterilerle yazışır, siz onaylarsınız", body: "Vade sonrası her taslak onay kuyruğuna düşer; tonu seçer, düzenler, tek tıkla onaylarsınız." },
      { title: "Ödeme gelir, AI eşleştirir", body: "Banka hareketleri faturalarla eşleşir; siz onaylamadan hiçbir durum değişmez." },
    ],
  },
  ai: {
    badge: "AI Tahsilat",
    title: "AI yazar, siz onaylarsınız.",
    body: "Vade öncesi nazik hatırlatmalar otomatik gider. Vade geçtikten sonra AI'nın hazırladığı her mesaj önce sizin önünüze düşer: tonu seçersiniz, gerekirse düzenlersiniz, sonra gönderilir.",
    points: [
      "Yalnızca gerçek fatura verisi: numara, tutar, vade",
      "Tehdit yok; uydurma faiz, ceza veya yasal iddia yok",
      "İndirimi ve ek süreyi yalnızca siz verirsiniz",
    ],
    card: {
      header: "Karar gerekli",
      customer: "ABC Teknoloji",
      grade: "D",
      amount: "€18.500",
      overdue: "12 gün gecikme",
      messageLabel: "Müşteri mesajı",
      message: "30 gün ek süre verebilir misiniz?",
      draftLabel: "AI taslağı",
      tabs: ["Yumuşak", "Kararlı"],
      drafts: [
        "Sayın Ayşe Hanım, talebinizi aldık. INV-2026-00182 numaralı €18.500 tutarındaki fatura için önerdiğiniz ödeme tarihini paylaşırsanız birlikte planlayalım.",
        "Sayın Ayşe Hanım, INV-2026-00182 numaralı €18.500 tutarındaki fatura 12 gündür açık. Ek süre değerlendirmesi için önce net bir ödeme tarihi bekliyoruz.",
      ],
      extend: "Ek süreyi onayla",
      hold: "Sevkiyatı durdur",
      send: "Onayla ve gönder",
    },
  },
  features: {
    title: "Bir tahsilat ekibinin ihtiyacı olan her şey",
    sub: "Tek bir çalışma alanında, denetlenebilir ve şeffaf.",
    items: [
      { title: "AI Tahsilat Asistanı", body: "Fatura verisine dayalı, müşterinin dilinde, tonunu sizin belirlediğiniz hatırlatmalar ve yanıtlar." },
      { title: "Müşteri Derecesi A–E", body: "Ödeme davranışından türetilen tek bir harf; nedenleri açık, şirket kuralı yanında." },
      { title: "Ödeme Mutabakatı", body: "Gelen ödemeler için tutar, referans ve tarih bazlı eşleşme önerileri; onaylamadan durum değişmez." },
      { title: "Gelen Kutusu", body: "Finans ve satış tek yerde: onay bekleyenler, müşteri yanıtları ve kararlar tek listede." },
      { title: "Otomasyon Kuralları", body: "Hangi aşamada, kaç gün sonra, hangi kanaldan; onay gerekip gerekmediğine siz karar verirsiniz." },
      { title: "İnsan Kontrolü", body: "AI asla tehdit etmez, yasal iddia üretmez, indirim vermez; belirsiz durumları insana bırakır." },
    ],
  },
  grades: {
    title: "Müşteri Derecesi",
    sub: "Her müşteri için tek harf. Yeni bir çalışan harfi ve kuralı okur; formülü bilmek zorunda değildir.",
    letters: { A: "Zamanında öder", B: "Küçük gecikmelerle öder", C: "Düzenli gecikiyor", D: "Sorunlu", E: "Stop listesi" },
    card: {
      customer: "ABC Teknoloji",
      grade: "D",
      label: "Sorunlu",
      factsLabel: "Neden bu derece",
      facts: ["Son 90 günde 2 tutulmayan ödeme sözü", "Ortalama gecikme 23 gün ve artıyor", "Açık bakiye kredi limitinin %140'ı"],
      ruleLabel: "Şirket kuralı",
      rule: "Yeni sipariş öncesi açık bakiyenin tahsilini şart koşun.",
      disclaimer: "Derece yalnızca bu sistemdeki ödeme geçmişinden hesaplanır; dahili kullanım içindir, müşteriyle paylaşılmaz.",
    },
  },
  pricing: { title: "Fiyatlandırma", sub: "Ekibinizin büyüklüğüne göre, şeffaf planlar.", note: "Fiyatlar yer tutucudur." },
  faq: {
    title: "Sık sorulan sorular",
    sub: "Demo, güvenlik ve AI'nın sınırları hakkında.",
    items: [
      { q: "Demo modunda AI gerçekten e-posta gönderiyor mu?", a: "Hayır. Bir e-posta veya WhatsApp sağlayıcısı yapılandırılmadığı sürece hiçbir mesaj gerçekten gönderilmez; kayıtlar 'Simüle edildi' olarak tutulur. Demo tamamen güvenlidir." },
      { q: "AI müşterilerimi tehdit eder mi?", a: "Hayır. AI asla yasal işlemle tehdit etmez, faiz veya ceza uydurmaz, indirim veya vade uzatımı vermez. Bu kurallar sistem seviyesinde uygulanır; ihlal eden çıktılar reddedilir ve belirsiz durumlar insana yönlendirilir." },
      { q: "Banka entegrasyonu var mı?", a: "Bu sürümde banka hareketlerini CSV ile içe aktarırsınız. Doğrudan banka bağlantıları ve ERP entegrasyonları Business planın yol haritasındadır." },
      { q: "WhatsApp ile mesaj gönderebilir miyim?", a: "Evet. WhatsApp Business API bilgilerinizi tanımladığınızda hatırlatmalar WhatsApp üzerinden de gidebilir. Tanımlanmadığında mesajlar 'WhatsApp'a hazır' olarak simüle edilir." },
      { q: "Verilerim diğer şirketlerden izole mi?", a: "Evet. Her tablo şirket bazlı satır seviyesi güvenlik (RLS) ile korunur; bir kullanıcı yalnızca kendi şirketinin verisine erişebilir." },
      { q: "Hangi diller destekleniyor?", a: "Arayüz Türkçe ve İngilizce. Müşteri mesajları her müşterinin tercih ettiği dilde üretilir." },
    ],
  },
  cta: {
    title: "Tahsilatı AI'ya bırakın, kararları siz verin.",
    sub: "Demo verisiyle iki dakikada deneyin; kredi kartı gerekmez.",
    demo: "Demo'yu Gör",
    start: "Ücretsiz Başla",
  },
  footer: { tagline: "Türk şirketleri için yapay zekâ destekli B2B tahsilat.", signIn: "Giriş", signUp: "Kayıt", privacy: "Gizlilik", rights: "© 2026 Alacore. Tüm hakları saklıdır." },
};

const en: LandingCopy = {
  meta: {
    title: "Alacore — AI-powered B2B collections assistant",
    description: "Alacore tracks your due and overdue B2B invoices, communicates with your customers and manages the payment process for you.",
  },
  nav: { how: "How it works", features: "Features", pricing: "Pricing", faq: "FAQ", signIn: "Sign in", start: "Start free", inbox: "Inbox" },
  hero: {
    badge: "AI-powered collections",
    headline: "Stop chasing customers to get paid.",
    accent: "to get paid.",
    sub: "Alacore tracks your due and overdue B2B invoices, communicates with your customers and manages the payment process for you.",
    demo: "See the demo",
    start: "Start free",
    note: "No credit card · Demo in 2 minutes",
  },
  preview: {
    title: "Collections summary",
    demo: "Demo",
    dataNote: "Demo data",
    stats: [
      { label: "Total receivables", value: 4_280_000, kind: "money" },
      { label: "Collected with AI", value: 1_240_000, kind: "money" },
      { label: "Collection rate", value: 91.4, kind: "percent" },
      { label: "Overdue accounts", value: 124, kind: "count" },
    ],
    inboxTitle: "AI Inbox",
    rows: [
      { grade: "A", customer: "Kuzey Gıda", amount: "₺86,400", overdue: "Due in 2 days", status: "sent" },
      { grade: "C", customer: "Marmara Yapı", amount: "₺142,300", overdue: "9 days overdue", status: "pending" },
      { grade: "D", customer: "ABC Teknoloji", amount: "€18,500", overdue: "12 days overdue", status: "decision" },
    ],
    status: { sent: "Sent automatically", pending: "Awaiting approval", decision: "Decision needed" },
    feedTitle: "AI activity",
    feed: [
      { text: "AI sent a reminder · Kuzey Gıda · 2 min ago", tone: "info" },
      { text: "Payment promise received · Marmara Yapı · 14 min ago", tone: "warning" },
      { text: "₺8,420 payment matched · Çukurova Tarım · 41 min ago", tone: "success" },
    ],
  },
  facts: ["Pre-due reminders go out automatically", "Every post-due message is human-approved", "Customer rating A–E"],
  how: {
    flow: { sources: ["ERP / CSV", "e-Invoice", "Bank"], engine: "Alacore AI", outputs: ["Email", "WhatsApp", "Approval inbox"] },
    title: "How it works",
    sub: "Four steps, with the decision yours at every one.",
    steps: [
      { title: "Connect your invoices", body: "Upload a CSV or import from e-Invoice. Customers are created automatically." },
      { title: "AI detects overdue accounts", body: "It watches due dates and surfaces delays, broken promises and risky accounts." },
      { title: "AI writes to customers, you approve", body: "After the due date every draft lands in your approval queue; pick the tone, edit, approve in one click." },
      { title: "Payment arrives, AI matches it", body: "Bank transactions are matched to invoices; nothing changes state until you approve." },
    ],
  },
  ai: {
    badge: "AI Collections",
    title: "AI writes. You approve.",
    body: "Polite pre-due reminders go out automatically. Once an invoice is past due, every message the AI drafts lands in front of you first: you choose the tone, edit if needed, then it is sent.",
    points: [
      "Only real invoice facts: number, amount, due date",
      "No threats; no invented interest, penalties or legal claims",
      "Discounts and extensions are granted only by you",
    ],
    card: {
      header: "Decision needed",
      customer: "ABC Teknoloji",
      grade: "D",
      amount: "€18,500",
      overdue: "12 days overdue",
      messageLabel: "Customer message",
      message: "Could you grant a 30-day extension?",
      draftLabel: "AI draft",
      tabs: ["Soft", "Firm"],
      drafts: [
        "Dear Ms. Yılmaz, we have received your request. If you share the payment date you propose for invoice INV-2026-00182 (€18,500), we can plan it together.",
        "Dear Ms. Yılmaz, invoice INV-2026-00182 (€18,500) has been open for 12 days. Before we can consider an extension we need a firm payment date.",
      ],
      extend: "Approve extension",
      hold: "Hold shipments",
      send: "Approve and send",
    },
  },
  features: {
    title: "Everything a collections team needs",
    sub: "One workspace, auditable and transparent.",
    items: [
      { title: "AI Collections Assistant", body: "Reminders and replies grounded in invoice data, in the customer's language, with the tone you choose." },
      { title: "Customer Rating A–E", body: "One letter derived from payment behaviour; the reasons are explicit and your company rule sits next to it." },
      { title: "Payment Reconciliation", body: "Match suggestions for incoming payments by amount, reference and date; nothing changes until you approve." },
      { title: "Inbox", body: "Finance and sales in one place: pending approvals, customer replies and decisions in a single list." },
      { title: "Automation Rules", body: "Which stage, after how many days, on which channel, and whether approval is required. Your call." },
      { title: "Human Control", body: "The AI never threatens, never makes legal claims, never grants discounts; uncertain cases go to a human." },
    ],
  },
  grades: {
    title: "Customer Rating",
    sub: "One letter per customer. A new employee reads the letter and the rule; they do not need to know the formula.",
    letters: { A: "Pays on time", B: "Pays with small delays", C: "Regularly late", D: "Problematic", E: "Stop list" },
    card: {
      customer: "ABC Teknoloji",
      grade: "D",
      label: "Problematic",
      factsLabel: "Why this rating",
      facts: ["2 broken payment promises in the last 90 days", "Average delay 23 days and rising", "Open balance is 140% of credit limit"],
      ruleLabel: "Company rule",
      rule: "Require settlement of the open balance before new orders.",
      disclaimer: "The rating is computed only from payment history in this system; internal use only, never shared with the customer.",
    },
  },
  pricing: { title: "Pricing", sub: "Transparent plans that scale with your team.", note: "Prices are placeholders." },
  faq: {
    title: "Frequently asked questions",
    sub: "About the demo, security and the limits of the AI.",
    items: [
      { q: "Does the AI send real emails in the demo?", a: "No. Unless an email or WhatsApp provider is configured, no message is actually sent; records are kept as 'Simulated'. The demo is completely safe." },
      { q: "Will the AI threaten my customers?", a: "No. The AI never threatens legal action, never invents interest or penalties, and never grants discounts or extensions. These rules are enforced at the system level; violating output is rejected and uncertain cases are escalated to a human." },
      { q: "Is there a bank integration?", a: "In this version you import bank transactions via CSV. Direct bank connections and ERP integrations are on the Business plan roadmap." },
      { q: "Can I send messages over WhatsApp?", a: "Yes. Once your WhatsApp Business API credentials are configured, reminders can go out over WhatsApp. Without them, messages are simulated as 'Ready for WhatsApp'." },
      { q: "Is my data isolated from other companies?", a: "Yes. Every table is protected by per-company row-level security (RLS); a user can only ever access their own company's data." },
      { q: "Which languages are supported?", a: "The interface is available in Turkish and English. Customer messages are generated in each customer's preferred language." },
    ],
  },
  cta: {
    title: "Let AI handle collections. You make the decisions.",
    sub: "Try it with demo data in two minutes; no credit card required.",
    demo: "See the demo",
    start: "Start free",
  },
  footer: { tagline: "AI-powered B2B collections for Turkish companies.", signIn: "Sign in", signUp: "Sign up", privacy: "Privacy", rights: "© 2026 Alacore. All rights reserved." },
};

export const LANDING_COPY: Record<Locale, LandingCopy> = { tr, en };
