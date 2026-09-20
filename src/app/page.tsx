import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  BadgeCheck,
  Bot,
  CalendarClock,
  CircleHelp,
  Clock,
  Languages,
  Lock,
  MessagesSquare,
  MessageSquare,
  ShieldAlert,
  TrendingDown,
  Upload,
  UserCheck,
  Workflow,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import { PricingGrid } from "@/components/marketing/pricing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export const metadata: Metadata = {
  title: { absolute: "AlacakAI — Yapay zekâ destekli B2B tahsilat asistanı" },
  description: "AlacakAI, vadesi gelen ve geciken B2B faturalarınızı takip eder, müşterilerinizle iletişim kurar ve ödeme süreçlerini sizin için yönetir.",
};

const COPY = {
  tr: {
    nav: { how: "Nasıl çalışır", features: "Özellikler", pricing: "Fiyatlandırma", faq: "SSS", signIn: "Giriş yap", start: "Ücretsiz Başla", dashboard: "Dashboard" },
    hero: {
      eyebrow: "B2B alacak yönetimi için yapay zekâ",
      headline: "Paranızı almak için müşterilerinizi takip etmek zorunda kalmayın.",
      sub: "AlacakAI, vadesi gelen ve geciken B2B faturalarınızı takip eder, müşterilerinizle iletişim kurar ve ödeme süreçlerini sizin için yönetir.",
      demo: "Demo'yu Gör",
      start: "Ücretsiz Başla",
      note: "Kredi kartı gerekmez · Demo verisiyle 2 dakikada başlayın",
    },
    preview: {
      title: "Genel Bakış",
      badge: "Demo verisi",
      stats: [
        { label: "Toplam Alacak", value: "₺4.280.000" },
        { label: "Gecikmiş", value: "₺720.000", tone: "critical" },
        { label: "Bu Hafta", value: "₺430.000", tone: "warning" },
        { label: "Bu Ay Tahsil", value: "₺2.850.000", tone: "success" },
        { label: "Tahsilat Oranı", value: "%91,4" },
      ],
      overdueTitle: "Gecikmiş Faturalar",
      row: { customer: "ABC Teknoloji A.Ş.", invoice: "INV-2026-00182", amount: "€18.500", delay: "12 gün gecikme", risk: "YÜKSEK", ai: "AI takipte" },
    },
    problem: {
      title: "Tahsilat, finans ekibinin en pahalı manuel işi",
      sub: "Fatura kesmek kolay; parayı zamanında almak değil.",
      items: [
        { title: "Manuel takip", body: "Her ay aynı e-postalar, aynı telefonlar, aynı Excel. Kim aradı, kim ne dedi, kimse tam bilmiyor." },
        { title: "Görünmeyen risk", body: "Hangi müşterinin gerçekten ödeyeceğini geç öğrenirsiniz; sinyaller yazışmalarda kaybolur." },
        { title: "Nakit akışı sürprizleri", body: "Sözler tutulmaz, vadeler kayar; ay sonunda planladığınız tahsilat gelmez." },
      ],
    },
    how: {
      title: "Nasıl çalışır",
      sub: "Dört adım; her adımda insan kontrolü sizde.",
      steps: [
        { title: "Faturaları içe aktarın", body: "CSV yükleyin veya manuel ekleyin. Müşteriler otomatik oluşturulur." },
        { title: "AI vadeleri izler ve hatırlatır", body: "Vade öncesi, vade günü ve gecikme aşamalarında nazik, profesyonel veya kararlı mesaj taslakları hazırlar." },
        { title: "Yanıtları sınıflandırır, sözleri kaydeder", body: "Ödeme sözü, itiraz, ek süre talebi… Her yanıt yapılandırılmış veriye dönüşür ve takip edilir." },
        { title: "Ödemeleri eşleştirir, riskli müşterileri gösterir", body: "Banka hareketleri faturalarla eşleşir; ödeme davranışına göre risk skoru güncellenir." },
      ],
    },
    features: {
      title: "Bir tahsilat ekibinin ihtiyacı olan her şey",
      sub: "Tek bir çalışma alanında, denetlenebilir ve şeffaf.",
      items: [
        { title: "AI Tahsilat Asistanı", body: "Fatura verisine dayalı, müşterinin dilinde, tonunu sizin belirlediğiniz hatırlatmalar." },
        { title: "Risk Tespiti", body: "Gecikme geçmişi, tutulmayan sözler ve açık bakiyeye göre 0–100 risk skoru ve gerekçeleri." },
        { title: "Ödeme Mutabakatı", body: "Gelen ödemeler için tutar, referans ve tarih bazlı eşleşme önerileri; onaylamadan durum değişmez." },
        { title: "İletişim Merkezi", body: "Tüm giden ve gelen mesajlar, sınıflandırma ve sonraki adım tek bir zaman çizelgesinde." },
        { title: "Otomasyon Kuralları", body: "Hangi aşamada, kaç gün sonra, hangi kanaldan; onay gerekip gerekmediğine siz karar verirsiniz." },
        { title: "İnsan Kontrolü", body: "AI asla tehdit etmez, yasal iddia üretmez, indirim vermez; belirsiz durumları insana bırakır." },
      ],
    },
    deep: {
      collection: {
        title: "AI Collection",
        body: "AlacakAI, her fatura için doğru zamanda doğru tonda mesaj hazırlar. Yalnızca fatura numarası, tutar ve vade gibi gerçek verileri kullanır; faiz, ceza veya yasal sonuç eklemez. Onay kuyruğu açıkken hiçbir mesaj sizin görmeden gönderilmez.",
        exampleLabel: "Örnek hatırlatma · 8–30 gün gecikme · Profesyonel",
        subject: "Konu: INV-2026-00182 numaralı fatura hakkında",
        message: "Sayın Ayşe Hanım,\n\n15.08.2026 vadeli, €18.500 tutarındaki INV-2026-00182 numaralı faturanızın ödemesi kayıtlarımıza henüz ulaşmadı. Ödeme tarihinizi bizimle paylaşabilir misiniz? Bir sorun varsa yardımcı olmaktan memnuniyet duyarız.\n\nSaygılarımızla,\nDemo Teknoloji Finans",
        status: "Onay bekliyor",
      },
      risk: {
        title: "Risk Detection",
        body: "Her müşteri için ödeme davranışından türetilen bir risk skoru. Skor müşteriyle asla paylaşılmaz; yalnızca ekibinizin önceliklendirmesi içindir. Gerekçeler açık, öneri somuttur.",
        score: "82",
        level: "Yüksek",
        reasons: ["Son 90 günde 2 tutulmayan ödeme sözü", "Ortalama gecikme 23 gün ve artıyor", "Açık bakiye kredi limitinin %140'ı"],
        recommendation: "Yeni sipariş öncesi açık bakiyenin tahsilini şart koşun; kararlı ton ile takip edin.",
        recommendationLabel: "AI önerisi",
      },
      reconciliation: {
        title: "Payment Reconciliation",
        body: "Banka hareketlerini içe aktarın; AlacakAI tutar, para birimi, referans ve müşteri eşleşmesine göre en olası faturayı önerir. Eşleştirme yalnızca bir insan onayladığında gerçekleşir.",
        incoming: "Gelen ödeme",
        matched: "Önerilen fatura",
        confidence: "Güven",
        reasons: ["Tutar birebir eşleşiyor", "Açıklamada fatura numarası geçiyor", "Aynı müşteriden 3 gün içinde"],
        approve: "Onayla",
      },
    },
    pricing: { title: "Fiyatlandırma", sub: "Ekibinizin büyüklüğüne göre, şeffaf planlar.", note: "Fiyatlar yer tutucudur." },
    faq: {
      title: "Sık sorulan sorular",
      items: [
        { q: "Demo modunda AI gerçekten e-posta gönderiyor mu?", a: "Hayır. Bir e-posta veya WhatsApp sağlayıcısı yapılandırılmadığı sürece hiçbir mesaj gerçekten gönderilmez; kayıtlar 'Simüle edildi' olarak tutulur. Demo tamamen güvenlidir." },
        { q: "AI müşterilerimi tehdit eder mi?", a: "Hayır. AI asla yasal işlemle tehdit etmez, faiz veya ceza uydurmaz, indirim veya vade uzatımı vermez. Bu kurallar sistem seviyesinde uygulanır; ihlal eden çıktılar reddedilir ve belirsiz durumlar insana yönlendirilir." },
        { q: "Banka entegrasyonu var mı?", a: "Bu sürümde banka hareketlerini CSV ile içe aktarırsınız. Doğrudan banka bağlantıları ve ERP entegrasyonları Business planın yol haritasındadır." },
        { q: "WhatsApp ile mesaj gönderebilir miyim?", a: "Evet. WhatsApp Business API bilgilerinizi tanımladığınızda hatırlatmalar WhatsApp üzerinden de gidebilir. Tanımlanmadığında mesajlar 'WhatsApp'a hazır' olarak simüle edilir." },
        { q: "Verilerim diğer şirketlerden izole mi?", a: "Evet. Her tablo şirket bazlı satır seviyesi güvenlik (RLS) ile korunur; bir kullanıcı yalnızca kendi şirketinin verisine erişebilir." },
        { q: "Hangi diller destekleniyor?", a: "Arayüz Türkçe ve İngilizce. Müşteri mesajları her müşterinin tercih ettiği dilde üretilir." },
      ],
    },
    footer: { signIn: "Giriş", signUp: "Kayıt", privacy: "Gizlilik", rights: "© 2026 AlacakAI. Tüm hakları saklıdır." },
  },
  en: {
    nav: { how: "How it works", features: "Features", pricing: "Pricing", faq: "FAQ", signIn: "Sign in", start: "Start free", dashboard: "Dashboard" },
    hero: {
      eyebrow: "AI for B2B receivables",
      headline: "Stop chasing customers to get paid.",
      sub: "AlacakAI tracks your due and overdue B2B invoices, communicates with your customers and manages the payment process for you.",
      demo: "See the demo",
      start: "Start free",
      note: "No credit card · Start with demo data in 2 minutes",
    },
    preview: {
      title: "Dashboard",
      badge: "Demo data",
      stats: [
        { label: "Total receivables", value: "₺4,280,000" },
        { label: "Overdue", value: "₺720,000", tone: "critical" },
        { label: "Due this week", value: "₺430,000", tone: "warning" },
        { label: "Collected this month", value: "₺2,850,000", tone: "success" },
        { label: "Collection rate", value: "91.4%" },
      ],
      overdueTitle: "Overdue invoices",
      row: { customer: "ABC Teknoloji A.Ş.", invoice: "INV-2026-00182", amount: "€18,500", delay: "12 days overdue", risk: "HIGH", ai: "AI following up" },
    },
    problem: {
      title: "Collections is the most expensive manual job in finance",
      sub: "Issuing invoices is easy; getting paid on time is not.",
      items: [
        { title: "Manual chasing", body: "The same emails, calls and spreadsheets every month. Who called whom and what was said is nowhere." },
        { title: "Unknown risk", body: "You find out too late which customers will actually pay; the signals are buried in email threads." },
        { title: "Cash-flow surprises", body: "Promises slip, due dates slide, and the cash you planned for month-end never arrives." },
      ],
    },
    how: {
      title: "How it works",
      sub: "Four steps, with a human in control at every one.",
      steps: [
        { title: "Import invoices", body: "Upload a CSV or add them manually. Customers are created automatically." },
        { title: "AI watches due dates and reminds", body: "Polite, professional or firm drafts before due, on the due day and at each overdue stage." },
        { title: "Classifies replies, records promises", body: "Payment promise, dispute, extension request… every reply becomes structured data that is followed up." },
        { title: "Matches payments, surfaces risky customers", body: "Bank transactions are matched to invoices; risk scores update from payment behaviour." },
      ],
    },
    features: {
      title: "Everything a collections team needs",
      sub: "One workspace, auditable and transparent.",
      items: [
        { title: "AI Collections Assistant", body: "Reminders grounded in invoice data, in the customer's language, with the tone you choose." },
        { title: "Risk Detection", body: "A 0–100 score with reasons, derived from delays, broken promises and open balance." },
        { title: "Payment Reconciliation", body: "Match suggestions for incoming payments by amount, reference and date; nothing changes until you approve." },
        { title: "Communication Center", body: "Every outbound and inbound message, its classification and the next step on one timeline." },
        { title: "Automation Rules", body: "Which stage, after how many days, on which channel — and whether approval is required. Your call." },
        { title: "Human Control", body: "The AI never threatens, never makes legal claims, never grants discounts; uncertain cases go to a human." },
      ],
    },
    deep: {
      collection: {
        title: "AI Collection",
        body: "AlacakAI drafts the right message at the right time for every invoice. It uses only real facts — invoice number, amount, due date — and never adds interest, penalties or legal consequences. With the approval queue on, nothing is sent before you see it.",
        exampleLabel: "Sample reminder · 8–30 days overdue · Professional",
        subject: "Subject: Regarding invoice INV-2026-00182",
        message: "Dear Ms. Yılmaz,\n\nWe have not yet received payment for invoice INV-2026-00182 (€18,500), which was due on 15 Aug 2026. Could you share your expected payment date? If anything is holding it up, we are happy to help.\n\nKind regards,\nDemo Teknoloji Finance",
        status: "Pending approval",
      },
      risk: {
        title: "Risk Detection",
        body: "A risk score per customer, derived from payment behaviour. It is never shared with the customer — it exists only to help your team prioritise. Reasons are explicit and the recommendation is concrete.",
        score: "82",
        level: "High",
        reasons: ["2 broken payment promises in the last 90 days", "Average delay 23 days and rising", "Open balance is 140% of credit limit"],
        recommendation: "Require settlement of the open balance before new orders; follow up with a firm tone.",
        recommendationLabel: "AI recommendation",
      },
      reconciliation: {
        title: "Payment Reconciliation",
        body: "Import bank transactions; AlacakAI proposes the most likely invoice using amount, currency, reference and customer. A match only happens when a human approves it.",
        incoming: "Incoming payment",
        matched: "Suggested invoice",
        confidence: "Confidence",
        reasons: ["Exact amount match", "Invoice number found in description", "Same customer, within 3 days"],
        approve: "Approve",
      },
    },
    pricing: { title: "Pricing", sub: "Transparent plans that scale with your team.", note: "Prices are placeholders." },
    faq: {
      title: "Frequently asked questions",
      items: [
        { q: "Does the AI send real emails in the demo?", a: "No. Unless an email or WhatsApp provider is configured, no message is actually sent; records are kept as 'Simulated'. The demo is completely safe." },
        { q: "Will the AI threaten my customers?", a: "No. The AI never threatens legal action, never invents interest or penalties, and never grants discounts or extensions. These rules are enforced at the system level; violating output is rejected and uncertain cases are escalated to a human." },
        { q: "Is there a bank integration?", a: "In this version you import bank transactions via CSV. Direct bank connections and ERP integrations are on the Business plan roadmap." },
        { q: "Can I send messages over WhatsApp?", a: "Yes. Once your WhatsApp Business API credentials are configured, reminders can go out over WhatsApp. Without them, messages are simulated as 'Ready for WhatsApp'." },
        { q: "Is my data isolated from other companies?", a: "Yes. Every table is protected by per-company row-level security (RLS); a user can only ever access their own company's data." },
        { q: "Which languages are supported?", a: "The interface is available in Turkish and English. Customer messages are generated in each customer's preferred language." },
      ],
    },
    footer: { signIn: "Sign in", signUp: "Sign up", privacy: "Privacy", rights: "© 2026 AlacakAI. All rights reserved." },
  },
} satisfies Record<Locale, unknown>;

const PROBLEM_ICONS = [Clock, CircleHelp, TrendingDown];
const STEP_ICONS = [Upload, CalendarClock, MessagesSquare, BadgeCheck];
const FEATURE_ICONS = [Bot, ShieldAlert, ArrowLeftRight, MessageSquare, Workflow, UserCheck];

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">A</span>
      <span className="text-sm font-semibold tracking-tight">AlacakAI</span>
    </Link>
  );
}

function SectionHeading({ title, sub, id }: { title: string; sub?: string; id?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center" id={id}>
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      {sub && <p className="mt-2 text-sm text-muted-foreground sm:text-base">{sub}</p>}
    </div>
  );
}

const STAT_TONE: Record<string, string> = { critical: "text-red-700", warning: "text-amber-700", success: "text-emerald-700" };

export default async function LandingPage() {
  const [{ locale }, user] = await Promise.all([getT(), getSessionUser()]);
  const c = COPY[locale];
  const signedIn = Boolean(user);

  return (
    <div className="flex min-h-screen flex-col bg-white text-foreground">
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Wordmark />
          <nav className="ml-6 hidden items-center gap-5 text-sm text-muted-foreground md:flex">
            <a href="#how" className="hover:text-foreground">{c.nav.how}</a>
            <a href="#features" className="hover:text-foreground">{c.nav.features}</a>
            <a href="#pricing" className="hover:text-foreground">{c.nav.pricing}</a>
            <a href="#faq" className="hover:text-foreground">{c.nav.faq}</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher locale={locale} />
            {signedIn ? (
              <Button asChild size="sm" variant="brand">
                <Link href="/inbox">{c.nav.dashboard} <ArrowRight /></Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                  <Link href="/login">{c.nav.signIn}</Link>
                </Button>
                <Button asChild size="sm" variant="brand">
                  <Link href="/signup">{c.nav.start}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="neutral" className="mb-5">{c.hero.eyebrow}</Badge>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">{c.hero.headline}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">{c.hero.sub}</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="brand" className="w-full sm:w-auto">
                <Link href="/login?demo=1">{c.hero.demo} <ArrowRight /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <Link href="/signup">{c.hero.start}</Link>
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{c.hero.note}</p>
          </div>

          {/* Product preview (static markup) */}
          <div className="mx-auto mt-14 max-w-5xl rounded-xl border bg-background p-2 shadow-sm">
            <div className="rounded-lg border bg-card">
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="grid size-5 place-items-center rounded bg-primary text-[10px] font-bold text-primary-foreground">A</span>
                  <span className="text-xs font-medium">{c.preview.title}</span>
                </div>
                <Badge variant="warning">{c.preview.badge}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-5">
                {c.preview.stats.map((s) => (
                  <div key={s.label} className="rounded-lg border bg-background p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
                    <p className={`mt-1 text-lg font-semibold tabular tracking-tight ${("tone" in s && s.tone && STAT_TONE[s.tone]) || ""}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="border-t px-3 pb-3 pt-2">
                <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{c.preview.overdueTitle}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-background px-3 py-2.5 text-sm">
                  <span className="font-medium">{c.preview.row.customer}</span>
                  <span className="font-mono text-xs text-muted-foreground">{c.preview.row.invoice}</span>
                  <span className="font-semibold tabular">{c.preview.row.amount}</span>
                  <span className="text-orange-700 tabular">{c.preview.row.delay}</span>
                  <Badge variant="serious">{c.preview.row.risk}</Badge>
                  <Badge variant="info" className="ml-auto"><Bot /> {c.preview.row.ai}</Badge>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="border-t bg-muted/30 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading title={c.problem.title} sub={c.problem.sub} />
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {c.problem.items.map((item, i) => {
                const Icon = PROBLEM_ICONS[i];
                return (
                  <div key={item.title} className="rounded-xl border bg-card p-6 shadow-xs">
                    <div className="grid size-9 place-items-center rounded-md border bg-background">
                      <Icon className="size-4 text-muted-foreground" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="scroll-mt-16 py-16 sm:py-20" id="how">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading title={c.how.title} sub={c.how.sub} />
            <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {c.how.steps.map((step, i) => {
                const Icon = STEP_ICONS[i];
                return (
                  <li key={step.title} className="relative rounded-xl border bg-card p-6 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
                        <Icon className="size-4" />
                      </div>
                      <span className="font-mono text-xs text-muted-foreground tabular">0{i + 1}</span>
                    </div>
                    <h3 className="mt-4 text-sm font-semibold">{step.title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section className="scroll-mt-16 border-t bg-muted/30 py-16 sm:py-20" id="features">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading title={c.features.title} sub={c.features.sub} />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {c.features.items.map((item, i) => {
                const Icon = FEATURE_ICONS[i];
                return (
                  <div key={item.title} className="rounded-xl border bg-card p-6 shadow-xs">
                    <Icon className="size-5 text-brand" />
                    <h3 className="mt-4 text-sm font-semibold">{item.title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Deep dives */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 sm:px-6">
            {/* AI Collection */}
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div>
                <Badge variant="info" className="mb-3"><Bot /> {c.deep.collection.title}</Badge>
                <h3 className="text-2xl font-semibold tracking-tight">{c.deep.collection.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground sm:text-base">{c.deep.collection.body}</p>
              </div>
              <div className="rounded-xl border bg-card p-5 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.deep.collection.exampleLabel}</p>
                  <Badge variant="warning">{c.deep.collection.status}</Badge>
                </div>
                <p className="mt-3 text-sm font-medium">{c.deep.collection.subject}</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{c.deep.collection.message}</p>
              </div>
            </div>

            {/* Risk */}
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div className="order-2 rounded-xl border bg-card p-5 shadow-xs lg:order-1">
                <div className="flex items-center gap-4">
                  <div className="grid size-16 place-items-center rounded-lg border border-orange-200 bg-orange-50">
                    <span className="text-2xl font-semibold tabular text-orange-800">{c.deep.risk.score}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">ABC Teknoloji A.Ş.</p>
                    <Badge variant="serious" className="mt-1"><ShieldAlert /> {c.deep.risk.level} · {c.deep.risk.score}/100</Badge>
                  </div>
                </div>
                <ul className="mt-4 flex flex-col gap-1.5 text-sm">
                  {c.deep.risk.reasons.map((r) => (
                    <li key={r} className="flex items-start gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-orange-500" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 rounded-md border bg-muted/40 p-3 text-xs">
                  <span className="font-medium">{c.deep.risk.recommendationLabel}:</span> {c.deep.risk.recommendation}
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <Badge variant="serious" className="mb-3"><ShieldAlert /> {c.deep.risk.title}</Badge>
                <h3 className="text-2xl font-semibold tracking-tight">{c.deep.risk.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground sm:text-base">{c.deep.risk.body}</p>
              </div>
            </div>

            {/* Reconciliation */}
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div>
                <Badge variant="success" className="mb-3"><ArrowLeftRight /> {c.deep.reconciliation.title}</Badge>
                <h3 className="text-2xl font-semibold tracking-tight">{c.deep.reconciliation.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground sm:text-base">{c.deep.reconciliation.body}</p>
              </div>
              <div className="rounded-xl border bg-card p-5 shadow-xs">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{c.deep.reconciliation.incoming}</p>
                    <p className="mt-1 text-lg font-semibold tabular">€18.500</p>
                    <p className="font-mono text-[11px] text-muted-foreground">ABC TEKNOLOJI INV182</p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{c.deep.reconciliation.matched}</p>
                    <p className="mt-1 font-mono text-sm font-medium">INV-2026-00182</p>
                    <p className="text-[11px] text-muted-foreground">ABC Teknoloji A.Ş.</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{c.deep.reconciliation.confidence}</span>
                  <Badge variant="success"><BadgeCheck /> %98</Badge>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-[98%] rounded-full bg-emerald-600" />
                </div>
                <ul className="mt-4 flex flex-col gap-1.5 text-xs text-muted-foreground">
                  {c.deep.reconciliation.reasons.map((r) => (
                    <li key={r} className="flex items-start gap-2">
                      <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                      {r}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex justify-end">
                  <span className="inline-flex h-8 items-center rounded-md bg-brand px-3 text-xs font-medium text-brand-foreground">{c.deep.reconciliation.approve}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="scroll-mt-16 border-t bg-muted/30 py-16 sm:py-20" id="pricing">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading title={c.pricing.title} sub={c.pricing.sub} />
            <div className="mt-10">
              <PricingGrid locale={locale} ctaHref="/signup" />
            </div>
            <p className="mt-4 text-center text-[11px] text-muted-foreground">{c.pricing.note}</p>
          </div>
        </section>

        {/* FAQ */}
        <section className="scroll-mt-16 py-16 sm:py-20" id="faq">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <SectionHeading title={c.faq.title} />
            <div className="mt-10 flex flex-col gap-2">
              {c.faq.items.map((item) => (
                <details key={item.q} className="group rounded-lg border bg-card px-5 py-3 open:shadow-xs">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Lock className="size-3.5" /> RLS</span>
              <span className="inline-flex items-center gap-1.5"><Languages className="size-3.5" /> TR / EN</span>
              <span className="inline-flex items-center gap-1.5"><UserCheck className="size-3.5" /> Human-in-the-loop</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <Wordmark />
          <nav className="flex items-center gap-5 text-xs text-muted-foreground">
            <Link href="/login" className="hover:text-foreground">{c.footer.signIn}</Link>
            <Link href="/signup" className="hover:text-foreground">{c.footer.signUp}</Link>
            <a href="#privacy" className="hover:text-foreground">{c.footer.privacy}</a>
          </nav>
          <p className="text-xs text-muted-foreground">{c.footer.rights}</p>
        </div>
      </footer>
    </div>
  );
}
