import type { Communication, Customer, Invoice, Organization, Payment, PaymentPromise } from "@/lib/types";
import { addDays, today } from "@/lib/domain/dates";
import { deriveStatus, outstanding, stageForInvoice } from "@/lib/domain/invoices";
import { formatMoney } from "@/lib/domain/money";
import { renderTemplate } from "@/lib/ai/templates";
import { renderEscalationAlternatives, renderReplyAlternatives } from "@/lib/ai/reply-templates";
import { computeRiskScore, defaultGradeRules, gradeForScore } from "@/lib/ai/risk-analyzer";
import { computeCustomerFinancials } from "@/lib/domain/metrics";
import { getMemoryDatabase, MemoryStore } from "./memory-store";
import type { DataStore } from "./store";

export const DEMO_ORG_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000002";
export const DEMO_EMAIL = "demo@alacore.app";
export const DEMO_PASSWORD = "demo1234";

export const DEFAULT_FX_RATES: Record<string, number> = { EUR: 48.5, USD: 41.2, GBP: 56.0, TRY: 1 };

export function demoOrganizationDefaults(name: string, overrides: Partial<Organization> = {}): Omit<Organization, "id" | "created_at"> {
  return {
    name,
    logo_url: null,
    address: null,
    tax_number: null,
    default_currency: "TRY",
    reporting_currency: "TRY",
    fx_rates: DEFAULT_FX_RATES,
    default_payment_terms_days: 30,
    language: "tr",
    is_demo: false,
    ai_auto_send: false,
    ai_confidence_threshold: 0.75,
    ai_default_tone: "PROFESSIONAL",
    ai_signature: null,
    sender_name: null,
    sender_email: null,
    whatsapp_number: null,
    grade_rules: defaultGradeRules(overrides.language ?? "tr"),
    approval_amount_threshold: 250000,
    ...overrides,
  };
}

/**
 * In demo mode (no Supabase) this creates the "Demo Teknoloji A.Ş." organization, its demo
 * user and the seeded dataset once per process. Safe to call on every request.
 */
export async function ensureDemoOrganization(): Promise<void> {
  const db = getMemoryDatabase();
  if (db.organizations.has(DEMO_ORG_ID)) return;
  const now = new Date().toISOString();
  db.organizations.set(DEMO_ORG_ID, {
    id: DEMO_ORG_ID,
    created_at: now,
    ...demoOrganizationDefaults("Demo Teknoloji A.Ş.", {
      is_demo: true,
      address: "Maslak Mah. Büyükdere Cad. No:255, Sarıyer / İstanbul",
      tax_number: "1234567890",
      ai_signature: "Demo Teknoloji A.Ş. Finans Departmanı",
      sender_name: "Demo Teknoloji Finans",
      sender_email: "finans@demoteknoloji.com",
    }),
  });
  db.users.set(DEMO_EMAIL, { id: DEMO_USER_ID, email: DEMO_EMAIL, password: DEMO_PASSWORD, full_name: "Zeynep Demir" });
  const store = new MemoryStore(DEMO_ORG_ID, db);
  await store.insert("profiles", { id: DEMO_USER_ID, email: DEMO_EMAIL, full_name: "Zeynep Demir", role: "OWNER" });
  await seedDemoData(store, { ownerUserId: DEMO_USER_ID });
  db.seededAt = now;
}

/** Resets the demo organization's data (memory mode). */
export async function resetDemoData(store: DataStore, ownerUserId: string): Promise<void> {
  await store.clearAll();
  if (store.kind === "memory") {
    await store.insert("profiles", { id: ownerUserId, email: DEMO_EMAIL, full_name: "Zeynep Demir", role: "OWNER" });
  }
  await seedDemoData(store, { ownerUserId });
}

type NewCustomer = Omit<Customer, "id" | "created_at" | "organization_id">;
type NewInvoice = Omit<Invoice, "id" | "created_at" | "organization_id">;

/**
 * Seeds a realistic dataset relative to *today*: 10 customers, 30 invoices, 20 payments,
 * overdue invoices, payment promises, communication history, AI actions and risk scores.
 * Works against any DataStore, so a real Supabase organization can load it from onboarding.
 */
export async function seedDemoData(store: DataStore, opts: { ownerUserId: string | null }): Promise<void> {
  const asOf = today();
  const d = (n: number) => addDays(asOf, n);
  const nowIso = new Date().toISOString();
  const org = await store.getOrganization();

  const customerDefs: NewCustomer[] = [
    { company_name: "ABC Teknoloji A.Ş.", contact_person: "Ahmet Yılmaz", email: "ahmet.yilmaz@abcteknoloji.com", phone: "+90 212 555 0101", whatsapp_number: "+90 532 555 0101", country: "TR", preferred_language: "tr", payment_terms_days: 30, credit_limit: 80000, currency: "EUR", notes: "Kurumsal müşteri; ödemeler genelde finans onayı sonrası gecikiyor.", account_manager_id: opts.ownerUserId, shipments_on_hold: false },
    { company_name: "Kuzey Gıda Ltd. Şti.", contact_person: "Elif Kaya", email: "elif.kaya@kuzeygida.com.tr", phone: "+90 232 555 0202", whatsapp_number: "+90 533 555 0202", country: "TR", preferred_language: "tr", payment_terms_days: 30, credit_limit: 500000, currency: "TRY", notes: null, account_manager_id: opts.ownerUserId, shipments_on_hold: false },
    { company_name: "Marmara Yapı Malzemeleri A.Ş.", contact_person: "Murat Demirci", email: "muhasebe@marmarayapi.com", phone: "+90 262 555 0303", whatsapp_number: null, country: "TR", preferred_language: "tr", payment_terms_days: 45, credit_limit: 750000, currency: "TRY", notes: null, account_manager_id: null, shipments_on_hold: false },
    { company_name: "Ege Tekstil San. Tic. Ltd.", contact_person: "Selin Arslan", email: "selin@egetekstil.com", phone: "+90 232 555 0404", whatsapp_number: "+90 535 555 0404", country: "TR", preferred_language: "tr", payment_terms_days: 30, credit_limit: 60000, currency: "EUR", notes: null, account_manager_id: null, shipments_on_hold: false },
    { company_name: "Anadolu Otomotiv Yedek Parça", contact_person: "Burak Şahin", email: "burak@anadoluotomotiv.com", phone: "+90 312 555 0505", whatsapp_number: "+90 536 555 0505", country: "TR", preferred_language: "tr", payment_terms_days: 60, credit_limit: 400000, currency: "TRY", notes: null, account_manager_id: null, shipments_on_hold: false },
    { company_name: "Nordwind Handel GmbH", contact_person: "Julia Weber", email: "j.weber@nordwind-handel.de", phone: "+49 40 555 0606", whatsapp_number: null, country: "DE", preferred_language: "en", payment_terms_days: 30, credit_limit: 120000, currency: "EUR", notes: "Prefers email. Finance closes on Fridays.", account_manager_id: null, shipments_on_hold: false },
    { company_name: "Baltic Foods OÜ", contact_person: "Kristjan Tamm", email: "kristjan@balticfoods.ee", phone: "+372 555 0707", whatsapp_number: null, country: "EE", preferred_language: "en", payment_terms_days: 30, credit_limit: 50000, currency: "EUR", notes: null, account_manager_id: null, shipments_on_hold: false },
    { company_name: "Karadeniz Mobilya San. A.Ş.", contact_person: "Hasan Çelik", email: "hasan.celik@karadenizmobilya.com", phone: "+90 462 555 0808", whatsapp_number: "+90 538 555 0808", country: "TR", preferred_language: "tr", payment_terms_days: 30, credit_limit: 300000, currency: "TRY", notes: "Son 6 ayda ödeme disiplini bozuldu.", account_manager_id: opts.ownerUserId, shipments_on_hold: false },
    { company_name: "Çukurova Tarım Ürünleri Ltd.", contact_person: "Ayşe Öztürk", email: "ayse@cukurovatarim.com", phone: "+90 322 555 0909", whatsapp_number: "+90 539 555 0909", country: "TR", preferred_language: "tr", payment_terms_days: 30, credit_limit: 250000, currency: "TRY", notes: null, account_manager_id: null, shipments_on_hold: false },
    { company_name: "Levant Trading FZE", contact_person: "Omar Haddad", email: "omar@levanttrading.ae", phone: "+971 4 555 1010", whatsapp_number: "+971 50 555 1010", country: "AE", preferred_language: "en", payment_terms_days: 45, credit_limit: 90000, currency: "USD", notes: null, account_manager_id: null, shipments_on_hold: false },
  ];
  const customers = await store.insertMany("customers", customerDefs);
  const C = Object.fromEntries(customers.map((c, i) => [i, c])) as Record<number, Customer>;

  // invoice helper: [customerIdx, number, invoiceDateOffset, dueOffset, amount, paid, statusOverride?]
  const inv = (ci: number, num: string, invOff: number, dueOff: number, amount: number, paid = 0, status?: Invoice["status"]): NewInvoice => {
    const c = C[ci];
    const base: Invoice = {
      id: "", created_at: "", organization_id: org.id,
      customer_id: c.id, invoice_number: num, invoice_date: d(invOff), due_date: d(dueOff), currency: c.currency,
      amount, paid_amount: paid, status: status ?? "SENT", collection_stage: "NONE", assigned_user_id: opts.ownerUserId,
      description: null, last_reminder_stage: null, last_reminder_at: null, updated_at: nowIso,
      document_path: null, document_name: null, external_ref: null, source: "DEMO",
    };
    const derived = status ?? deriveStatus(base, asOf);
    const { id: _i, created_at: _c, organization_id: _o, ...rest } = { ...base, status: derived };
    void _i; void _c; void _o;
    return rest;
  };

  const invoiceDefs: NewInvoice[] = [
    // ABC Teknoloji (EUR) – the headline case: €18,500 12 days overdue + history of late payments
    inv(0, "INV-2026-00182", -42, -12, 18500),
    inv(0, "INV-2026-00151", -75, -45, 12400, 12400, "PAID"),
    inv(0, "INV-2026-00121", -110, -80, 9800, 9800, "PAID"),
    inv(0, "INV-2026-00196", -20, 10, 21000),
    inv(0, "INV-2026-00088", -150, -120, 15200, 15200, "PAID"),
    // Kuzey Gıda (TRY) – reliable
    inv(1, "INV-2026-00190", -30, 0, 145000),
    inv(1, "INV-2026-00160", -62, -32, 132000, 132000, "PAID"),
    inv(1, "INV-2026-00130", -95, -65, 118500, 118500, "PAID"),
    inv(1, "INV-2026-00198", -10, 20, 156000),
    // Marmara Yapı (TRY) – medium, active promise
    inv(2, "INV-2026-00175", -55, -10, 320000),
    inv(2, "INV-2026-00140", -90, -45, 280000, 280000, "PAID"),
    inv(2, "INV-2026-00199", -8, 37, 410000),
    // Ege Tekstil (EUR) – due soon
    inv(3, "INV-2026-00193", -27, 3, 7400),
    inv(3, "INV-2026-00155", -70, -40, 6900, 6900, "PAID"),
    inv(3, "INV-2026-00118", -115, -85, 8100, 8100, "PAID"),
    // Anadolu Otomotiv (TRY) – partially paid, 5 days overdue
    inv(4, "INV-2026-00170", -65, -5, 240000, 90000),
    inv(4, "INV-2026-00135", -120, -60, 198000, 198000, "PAID"),
    inv(4, "INV-2026-00200", -5, 55, 175000),
    // Nordwind Handel (EUR, en) – 3 days overdue
    inv(5, "INV-2026-00186", -33, -3, 34200),
    inv(5, "INV-2026-00145", -80, -50, 28700, 28700, "PAID"),
    inv(5, "INV-2026-00110", -130, -100, 31500, 31500, "PAID"),
    // Baltic Foods (EUR, en) – pre-due window
    inv(6, "INV-2026-00194", -28, 2, 11800),
    inv(6, "INV-2026-00150", -72, -42, 10250, 10250, "PAID"),
    // Karadeniz Mobilya (TRY) – critical: 48 days overdue + disputed
    inv(7, "INV-2026-00148", -78, -48, 265000, 0, "ESCALATED"),
    inv(7, "INV-2026-00168", -60, -30, 142000, 0, "DISPUTED"),
    inv(7, "INV-2026-00105", -140, -110, 180000, 180000, "PAID"),
    // Çukurova Tarım (TRY) – clean
    inv(8, "INV-2026-00192", -25, 5, 98000),
    inv(8, "INV-2026-00158", -68, -38, 87500, 87500, "PAID"),
    // Levant Trading (USD, en) – waiting for approval, promise active
    inv(9, "INV-2026-00180", -50, -8, 42000),
    inv(9, "INV-2026-00138", -100, -55, 38500, 38500, "PAID"),
  ];
  const invoices = await store.insertMany("invoices", invoiceDefs);
  const byNum = new Map(invoices.map((i) => [i.invoice_number, i]));
  const I = (n: string) => byNum.get(n)!;

  // Payments: matched payments for PAID invoices (late by a realistic delay per customer), partial for Anadolu, two unmatched.
  const payDefs: Array<Omit<Payment, "id" | "created_at" | "organization_id">> = [];
  const paidWithDelay: Array<[string, number, string]> = [
    ["INV-2026-00151", 26, "ABC TEKNOLOJI INV151"], ["INV-2026-00121", 22, "ABC TEKNOLOJI 00121"], ["INV-2026-00088", 19, "ABC TEK INV-2026-00088"],
    ["INV-2026-00160", 1, "KUZEY GIDA INV-2026-00160"], ["INV-2026-00130", 0, "KUZEY GIDA 130"],
    ["INV-2026-00140", 9, "MARMARA YAPI INV140"],
    ["INV-2026-00155", 3, "EGE TEKSTIL 00155"], ["INV-2026-00118", 5, "EGE TEKSTIL INV118"],
    ["INV-2026-00135", 12, "ANADOLU OTO INV-2026-00135"],
    ["INV-2026-00145", 2, "NORDWIND INV-2026-00145"], ["INV-2026-00110", 4, "NORDWIND HANDEL 110"],
    ["INV-2026-00150", -1, "BALTIC FOODS 150"],
    ["INV-2026-00105", 41, "KARADENIZ MOBILYA 105"],
    ["INV-2026-00158", 0, "CUKUROVA TARIM 158"],
    ["INV-2026-00138", 14, "LEVANT TRADING INV138"],
  ];
  for (const [num, delay, ref] of paidWithDelay) {
    const i = I(num);
    payDefs.push({ customer_id: i.customer_id, payment_date: addDays(i.due_date, delay), amount: i.amount, currency: i.currency, reference: ref, matched_invoice_id: i.id, status: "MATCHED", source: "DEMO", bank_transaction_id: null, suggested_invoice_id: null, suggested_confidence: null, suggestion_reasons: null });
  }
  // Partial payment on Anadolu
  {
    const i = I("INV-2026-00170");
    payDefs.push({ customer_id: i.customer_id, payment_date: d(-4), amount: 90000, currency: "TRY", reference: "ANADOLU OTOMOTIV KISMI ODEME 170", matched_invoice_id: i.id, status: "PARTIAL", source: "DEMO", bank_transaction_id: null, suggested_invoice_id: null, suggested_confidence: null, suggestion_reasons: null });
  }
  // Older extra payments to reach 20 and make the "collected" chart alive
  for (const [ci, off, amount, ref] of [[1, -70, 96000, "KUZEY GIDA ONCEKI DONEM"], [2, -100, 150000, "MARMARA YAPI 2026-06"], [8, -95, 64000, "CUKUROVA TARIM MAYIS"]] as const) {
    payDefs.push({ customer_id: C[ci].id, payment_date: d(off), amount, currency: C[ci].currency, reference: ref, matched_invoice_id: null, status: "MATCHED", source: "DEMO", bank_transaction_id: null, suggested_invoice_id: null, suggested_confidence: null, suggestion_reasons: null });
  }
  // One unmatched incoming payment with an AI suggestion (Nordwind, minus bank charges)
  {
    const i = I("INV-2026-00186");
    payDefs.push({ customer_id: null, payment_date: d(-1), amount: 34175, currency: "EUR", reference: "NORDWIND HANDEL GMBH RE 186", matched_invoice_id: null, status: "UNMATCHED", source: "BANK_IMPORT", bank_transaction_id: null, suggested_invoice_id: i.id, suggested_confidence: 0.75, suggestion_reasons: ["Referans fatura numarasının son bloğunu içeriyor (186)", "Tutar kalan bakiyeye çok yakın (banka masrafı olabilir)", "Müşteri adı referansta geçiyor"] });
  }
  const payments = await store.insertMany("payments", payDefs);

  // Payment promises: 2 broken (ABC, on already-paid-late invoices), 2 active (Marmara, Levant)
  const promiseDefs: Array<Omit<PaymentPromise, "id" | "created_at" | "organization_id">> = [
    { customer_id: C[0].id, invoice_id: I("INV-2026-00151").id, promised_date: addDays(I("INV-2026-00151").due_date, 7), amount: 12400, currency: "EUR", status: "BROKEN", source_communication_id: null, notes: "Finans onayı sonrası ödeneceği söylendi", resolved_at: addDays(I("INV-2026-00151").due_date, 9) + "T09:00:00.000Z" },
    { customer_id: C[0].id, invoice_id: I("INV-2026-00121").id, promised_date: addDays(I("INV-2026-00121").due_date, 10), amount: 9800, currency: "EUR", status: "BROKEN", source_communication_id: null, notes: "Cuma günü ödeme sözü", resolved_at: addDays(I("INV-2026-00121").due_date, 12) + "T09:00:00.000Z" },
    { customer_id: C[2].id, invoice_id: I("INV-2026-00175").id, promised_date: d(4), amount: 320000, currency: "TRY", status: "ACTIVE", source_communication_id: null, notes: "Hakediş ödemesi sonrası", resolved_at: null },
    { customer_id: C[9].id, invoice_id: I("INV-2026-00180").id, promised_date: d(6), amount: 42000, currency: "USD", status: "ACTIVE", source_communication_id: null, notes: "Waiting for CFO approval; payment run next week", resolved_at: null },
  ];
  const promises = await store.insertMany("payment_promises", promiseDefs);
  await store.update("invoices", I("INV-2026-00175").id, { status: "PAYMENT_PROMISED" });
  await store.update("invoices", I("INV-2026-00180").id, { status: "PAYMENT_PROMISED" });
  for (const p of promises.filter((p) => p.status === "BROKEN")) {
    // link is informational; the invoices are already paid
    void p;
  }

  // Communications: outbound reminders (simulated), inbound replies with classifications, one pending draft.
  const facts = (i: Invoice, c: Customer) => ({ contactName: c.contact_person, customerName: c.company_name, companyName: org.name, invoiceNumber: i.invoice_number, amount: outstanding(i), currency: i.currency, dueDate: i.due_date, daysOverdue: Math.max(0, -1 * (Number(new Date(i.due_date)) - Number(new Date(asOf))) / 86400000), signature: org.ai_signature });
  const commDefs: Array<Omit<Communication, "id" | "created_at" | "organization_id">> = [];
  const out = (num: string, stage: Communication["stage"], daysAgo: number, status: Communication["status"] = "SENT_SIMULATED"): void => {
    const i = I(num);
    const c = customers.find((x) => x.id === i.customer_id)!;
    const f = facts(i, c);
    const t = renderTemplate(stage ?? "OVERDUE_EARLY", "PROFESSIONAL", { ...f, daysOverdue: Math.round(f.daysOverdue) }, c.preferred_language);
    commDefs.push({ customer_id: c.id, invoice_id: i.id, channel: c.email ? "EMAIL" : "WHATSAPP", direction: "OUTBOUND", subject: t.subject, body: t.body, language: c.preferred_language, stage, tone: "PROFESSIONAL", status, classification: null, ai_generated: true, generator: "template", sent_at: status === "PENDING_APPROVAL" ? null : d(-daysAgo) + "T09:15:00.000Z", provider_message_id: null, approval_reason: status === "PENDING_APPROVAL" ? "Tutar onay eşiğinin üzerinde" : null, next_action_at: status === "PENDING_APPROVAL" ? null : d(-daysAgo + 3), next_action_note: status === "PENDING_APPROVAL" ? null : c.preferred_language === "tr" ? "Yanıt gelmezse takip" : "Follow up if no reply", created_at: d(-daysAgo) + "T09:15:00.000Z" } as never);
  };
  const inb = (num: string, body: string, daysAgo: number, cls: Communication["classification"], nextAt: string | null, nextNote: string | null): void => {
    const i = I(num);
    const c = customers.find((x) => x.id === i.customer_id)!;
    commDefs.push({ customer_id: c.id, invoice_id: i.id, channel: "EMAIL", direction: "INBOUND", subject: null, body, language: c.preferred_language, stage: null, tone: null, status: "RECEIVED", classification: cls, ai_generated: false, generator: null, sent_at: d(-daysAgo) + "T14:40:00.000Z", provider_message_id: "simulated", next_action_at: nextAt, next_action_note: nextNote, created_at: d(-daysAgo) + "T14:40:00.000Z" } as never);
  };

  out("INV-2026-00182", "PRE_DUE", 15);
  out("INV-2026-00182", "OVERDUE_EARLY", 11);
  out("INV-2026-00182", "OVERDUE_MID", 4);
  inb("INV-2026-00182", "Merhaba, faturayı aldık ancak nakit akışımız bu ay sıkışık. 30 gün ek süre verebilir misiniz?", 3, { intent: "REQUEST_EXTENSION", confidence: 0.93, promised_date: null, requested_extension_days: 30, disputed_amount: null, reason: "Nakit akışı sıkışık; 30 gün ek süre talebi", urgency: "MEDIUM", requires_human: true, summary: "Customer asks for a 30-day extension due to tight cash flow.", engine: "rules" }, asOf, "İnsan incelemesi bekleniyor");
  out("INV-2026-00175", "OVERDUE_EARLY", 8);
  inb("INV-2026-00175", `Hakediş ödemesi ${d(4).split("-").reverse().join(".")} tarihinde hesabımıza geçiyor, aynı gün ödemeyi yapacağız.`, 7, { intent: "PAYMENT_DATE_PROMISED", confidence: 0.94, promised_date: d(4), requested_extension_days: null, disputed_amount: null, reason: null, urgency: "LOW", requires_human: false, summary: "Customer will pay on the promised date after receiving a progress payment.", engine: "rules" }, d(4), "Takip");
  out("INV-2026-00180", "OVERDUE_EARLY", 6);
  inb("INV-2026-00180", "Hi, the invoice is approved on our side and is waiting for CFO sign-off. Finance will process the payment next week.", 5, { intent: "WAITING_FOR_APPROVAL", confidence: 0.9, promised_date: d(6), requested_extension_days: null, disputed_amount: null, reason: "Waiting for CFO sign-off", urgency: "LOW", requires_human: false, summary: "Payment approved internally, awaiting CFO sign-off; expected next week.", engine: "rules" }, d(6), "Follow up");
  out("INV-2026-00148", "OVERDUE_MID", 35);
  out("INV-2026-00148", "ESCALATED", 17);
  out("INV-2026-00168", "OVERDUE_MID", 20);
  inb("INV-2026-00168", "Bu faturadaki 40 adet kalemin 12'si hasarlı geldi. Hatalı tutar var, mutabık değiliz; hasar tutanağını ekte gönderiyoruz.", 19, { intent: "DISPUTE", confidence: 0.91, promised_date: null, requested_extension_days: null, disputed_amount: null, reason: "12 kalem hasarlı; tutara itiraz", urgency: "HIGH", requires_human: true, summary: "Customer disputes the invoice: 12 of 40 items arrived damaged.", engine: "rules" }, asOf, "İnsan incelemesi bekleniyor");
  out("INV-2026-00186", "DUE_TODAY", 3);
  inb("INV-2026-00186", "Payment was sent yesterday from our Commerzbank account, reference RE 186. Please confirm receipt.", 1, { intent: "PAYMENT_CONFIRMED", confidence: 0.88, promised_date: null, requested_extension_days: null, disputed_amount: null, reason: null, urgency: "LOW", requires_human: false, summary: "Customer states the payment was sent yesterday.", engine: "rules" }, d(1), "Verify the payment in bank transactions");
  out("INV-2026-00170", "OVERDUE_EARLY", 4);
  out("INV-2026-00190", "PRE_DUE", 3);
  out("INV-2026-00194", "PRE_DUE", 0, "PENDING_APPROVAL");

  const comms = await store.insertMany("communications", commDefs);
  const pendingDraft = comms.find((c) => c.status === "PENDING_APPROVAL");

  // AI-prepared answers waiting for a human: one per open decision, plus routine drafts for the inbox.
  const replyDraft = async (num: string, intent: import("@/lib/types").Intent, reason: string, extra: { promisedDate?: string | null; extensionDays?: number | null } = {}, routed: import("@/lib/types").Audience = "BOTH") => {
    const i = I(num);
    const c = customers.find((x) => x.id === i.customer_id)!;
    const inbound = comms.find((x) => x.invoice_id === i.id && x.direction === "INBOUND") ?? null;
    const f = facts(i, c);
    const alt = renderReplyAlternatives(intent, { ...f, daysOverdue: Math.round(f.daysOverdue) }, c.preferred_language, extra);
    return store.insert("communications", { customer_id: c.id, invoice_id: i.id, channel: "EMAIL", direction: "OUTBOUND", subject: alt.soft.subject, body: alt.soft.body, language: c.preferred_language, stage: i.collection_stage, tone: "POLITE", status: "PENDING_APPROVAL", classification: null, ai_generated: true, generator: "template", sent_at: null, provider_message_id: null, next_action_at: null, next_action_note: null, in_reply_to: inbound?.id ?? null, alternatives: alt, snoozed_until: null, routed_to: routed, approval_reason: reason });
  };
  const abcDraft = await replyDraft("INV-2026-00182", "REQUEST_EXTENSION", "Müşteri 30 günlük ek süre istiyor · Müşteri nakit akışı sorunu bildiriyor · Daha önce 2 söz tutulmadı", { extensionDays: 30 });
  const karadenizDraft = await replyDraft("INV-2026-00168", "DISPUTE", "Müşteri faturaya itiraz ediyor · Ürün / sevkiyat sorunu bildirildi");
  const escalationDraft = await (async () => {
    const i = I("INV-2026-00148");
    const c = customers.find((x) => x.id === i.customer_id)!;
    const f = facts(i, c);
    const alt = renderEscalationAlternatives({ ...f, daysOverdue: Math.round(f.daysOverdue) }, c.preferred_language);
    return store.insert("communications", { customer_id: c.id, invoice_id: i.id, channel: "EMAIL", direction: "OUTBOUND", subject: alt.soft.subject, body: alt.soft.body, language: c.preferred_language, stage: "ESCALATED", tone: "POLITE", status: "PENDING_APPROVAL", classification: null, ai_generated: true, generator: "template", sent_at: null, provider_message_id: null, next_action_at: null, next_action_note: null, in_reply_to: null, alternatives: alt, snoozed_until: null, routed_to: "BOTH", approval_reason: "30+ gün gecikme; iki hatırlatmaya yanıt yok" });
  })();
  const nordwindDraft = await replyDraft("INV-2026-00186", "PAYMENT_CONFIRMED", "Reply to customer (Says payment made)", {}, "FINANCE");
  const anadoluDraft = await (async () => {
    const i = I("INV-2026-00170");
    const c = customers.find((x) => x.id === i.customer_id)!;
    const f = facts(i, c);
    const tpl = renderTemplate("OVERDUE_MID", "PROFESSIONAL", { ...f, daysOverdue: Math.round(f.daysOverdue) }, c.preferred_language);
    return store.insert("communications", { customer_id: c.id, invoice_id: i.id, channel: "EMAIL", direction: "OUTBOUND", subject: tpl.subject, body: tpl.body, language: c.preferred_language, stage: "OVERDUE_MID", tone: "PROFESSIONAL", status: "PENDING_APPROVAL", classification: null, ai_generated: true, generator: "template", sent_at: null, provider_message_id: null, next_action_at: null, next_action_note: null, in_reply_to: null, alternatives: null, snoozed_until: null, routed_to: "FINANCE", approval_reason: "Vade sonrası mesajlar insan onayı ister" });
  })();
  void nordwindDraft;
  void anadoluDraft;
  await store.update("invoices", I("INV-2026-00182").id, { last_reminder_stage: "OVERDUE_MID", last_reminder_at: d(-4) + "T09:15:00.000Z", collection_stage: "OVERDUE_MID" });
  await store.update("invoices", I("INV-2026-00175").id, { last_reminder_stage: "OVERDUE_EARLY", last_reminder_at: d(-8) + "T09:15:00.000Z", collection_stage: "OVERDUE_MID" });
  await store.update("invoices", I("INV-2026-00180").id, { last_reminder_stage: "OVERDUE_EARLY", last_reminder_at: d(-6) + "T09:15:00.000Z", collection_stage: "OVERDUE_MID" });
  await store.update("invoices", I("INV-2026-00148").id, { last_reminder_stage: "ESCALATED", last_reminder_at: d(-17) + "T09:15:00.000Z", collection_stage: "ESCALATED" });
  await store.update("invoices", I("INV-2026-00168").id, { last_reminder_stage: "OVERDUE_MID", last_reminder_at: d(-20) + "T09:15:00.000Z", collection_stage: "NONE" });
  await store.update("invoices", I("INV-2026-00186").id, { last_reminder_stage: "DUE_TODAY", last_reminder_at: d(-3) + "T09:15:00.000Z", collection_stage: "OVERDUE_EARLY" });
  await store.update("invoices", I("INV-2026-00170").id, { last_reminder_stage: "OVERDUE_EARLY", last_reminder_at: d(-4) + "T09:15:00.000Z", collection_stage: "OVERDUE_EARLY" });
  await store.update("invoices", I("INV-2026-00190").id, { last_reminder_stage: "PRE_DUE", last_reminder_at: d(-3) + "T09:15:00.000Z", collection_stage: "DUE_TODAY" });
  await store.update("invoices", I("INV-2026-00194").id, { last_reminder_stage: "PRE_DUE", last_reminder_at: nowIso, collection_stage: "PRE_DUE" });

  // Automation rules
  await store.insert("automation_rules", { pre_due_enabled: true, pre_due_days: 3, due_date_enabled: true, overdue_enabled: true, first_reminder_days: 1, second_reminder_days: 7, escalation_days: 30, channels: ["EMAIL", "WHATSAPP"], require_approval: true, auto_send_pre_due: true, sales_involved_after_days: 14 });

  // Set collection stages for all invoices according to the rules
  const rules = (await store.list("automation_rules"))[0];
  for (const i of await store.list("invoices")) {
    const stage = stageForInvoice(i, asOf, rules);
    if (stage !== i.collection_stage && !(i.collection_stage !== "NONE" && stage === "NONE")) await store.update("invoices", i.id, { collection_stage: stage });
  }

  // AI actions timeline (newest first in UI)
  const A = (x: { customer?: number; invoice?: string; comm?: string | null; type: import("@/lib/types").AiActionType; status: import("@/lib/types").AiActionStatus; severity: import("@/lib/types").Severity; title: string; description?: string | null; recommended?: string | null; daysAgo: number; payload?: Record<string, unknown> }) => ({
    customer_id: x.customer !== undefined ? C[x.customer].id : null,
    invoice_id: x.invoice ? I(x.invoice).id : null,
    communication_id: x.comm ?? null,
    type: x.type,
    status: x.status,
    severity: x.severity,
    title: x.title,
    description: x.description ?? null,
    recommended_action: x.recommended ?? null,
    payload: x.payload ?? null,
    resolved_at: null,
    resolved_by: null,
    created_at: d(-x.daysAgo) + "T09:20:00.000Z",
  });
  const money = (num: string) => formatMoney(outstanding(I(num)), I(num).currency, "tr");
  await store.insertMany("ai_actions", [
    A({ customer: 0, invoice: "INV-2026-00182", type: "REMINDER_SENT", status: "COMPLETED", severity: "SUCCESS", title: "Hatırlatma gönderildi: ABC Teknoloji A.Ş. (Simüle edildi)", description: "Vade öncesi hatırlatma", daysAgo: 15 }),
    A({ customer: 0, invoice: "INV-2026-00182", type: "REMINDER_SENT", status: "COMPLETED", severity: "SUCCESS", title: "Hatırlatma gönderildi: ABC Teknoloji A.Ş. (Simüle edildi)", description: "1–7 gün gecikme", daysAgo: 11 }),
    A({ customer: 2, invoice: "INV-2026-00175", type: "REMINDER_SENT", status: "COMPLETED", severity: "SUCCESS", title: "Hatırlatma gönderildi: Marmara Yapı Malzemeleri A.Ş. (Simüle edildi)", description: "1–7 gün gecikme", daysAgo: 8 }),
    A({ customer: 2, invoice: "INV-2026-00175", type: "REPLY_CLASSIFIED", status: "COMPLETED", severity: "INFO", title: "Yanıt sınıflandırıldı: Marmara Yapı → Ödeme tarihi sözü", description: "Hakediş sonrası ödeme (94%, rules)", daysAgo: 7 }),
    A({ customer: 2, invoice: "INV-2026-00175", type: "PROMISE_RECORDED", status: "COMPLETED", severity: "SUCCESS", title: `Ödeme sözü kaydedildi: Marmara Yapı · ${d(4)}`, description: `INV-2026-00175 · ${money("INV-2026-00175")}`, daysAgo: 7 }),
    A({ customer: 9, invoice: "INV-2026-00180", type: "REMINDER_SENT", status: "COMPLETED", severity: "SUCCESS", title: "Reminder sent: Levant Trading FZE (Simulated)", description: "1–7 days overdue", daysAgo: 6 }),
    A({ customer: 9, invoice: "INV-2026-00180", type: "PROMISE_RECORDED", status: "COMPLETED", severity: "SUCCESS", title: `Ödeme sözü kaydedildi: Levant Trading FZE · ${d(6)}`, description: `INV-2026-00180 · ${money("INV-2026-00180")}`, daysAgo: 5 }),
    A({ customer: 0, invoice: "INV-2026-00182", type: "REMINDER_SENT", status: "COMPLETED", severity: "SUCCESS", title: "Hatırlatma gönderildi: ABC Teknoloji A.Ş. (Simüle edildi)", description: "8–30 gün gecikme", daysAgo: 4 }),
    A({ customer: 0, invoice: "INV-2026-00182", type: "REPLY_CLASSIFIED", status: "COMPLETED", severity: "INFO", title: "Yanıt sınıflandırıldı: ABC Teknoloji → Ek süre talebi", description: "30 gün ek süre talebi (93%, rules)", daysAgo: 3 }),
    A({ customer: 0, invoice: "INV-2026-00182", type: "ESCALATION", status: "NEEDS_HUMAN", severity: "WARNING", title: "ABC Teknoloji A.Ş.: Ek süre talebi", description: "Müşteri 30 günlük ek süre istiyor · Müşteri nakit akışı sorunu bildiriyor · Daha önce 2 söz tutulmadı", recommended: "Ek süreyi onaylamadan önce kredi riskini gözden geçirin.", daysAgo: 3, payload: { intent: "REQUEST_EXTENSION", invoice_number: "INV-2026-00182", outstanding: 18500, currency: "EUR", draft_id: abcDraft.id, requested_extension_days: 30 } }),
    A({ customer: 7, invoice: "INV-2026-00148", type: "ESCALATION", status: "NEEDS_HUMAN", severity: "CRITICAL", title: "Eskalasyon: Karadeniz Mobilya San. A.Ş. · INV-2026-00148", description: "30+ gün gecikme; iki hatırlatmaya yanıt yok", recommended: "Hesap yöneticisi müşteriyle ödeme planını görüşmeli; yeni sevkiyatları durdurun.", daysAgo: 17, payload: { days_overdue: 48, outstanding: 265000, currency: "TRY", draft_id: escalationDraft.id } }),
    A({ customer: 7, invoice: "INV-2026-00168", type: "ESCALATION", status: "NEEDS_HUMAN", severity: "CRITICAL", title: "Karadeniz Mobilya San. A.Ş.: İtiraz", description: "Müşteri faturaya itiraz ediyor · Ürün / sevkiyat sorunu bildirildi", recommended: "Hasar tutanağını operasyonla doğrulayıp müşteriyle mutabakat yapın.", daysAgo: 19, payload: { intent: "DISPUTE", invoice_number: "INV-2026-00168", outstanding: 142000, currency: "TRY", draft_id: karadenizDraft.id } }),
    A({ customer: 5, invoice: "INV-2026-00186", type: "REPLY_CLASSIFIED", status: "COMPLETED", severity: "INFO", title: "Reply classified: Nordwind Handel → Says payment made", description: "Payment sent yesterday (88%, rules)", daysAgo: 1 }),
    A({ customer: 5, invoice: "INV-2026-00186", type: "PAYMENT_MATCH_SUGGESTED", status: "PENDING_APPROVAL", severity: "INFO", title: "Eşleşme önerildi: €34.175,00 → INV-2026-00186", description: "Nordwind Handel GmbH · 75%", daysAgo: 1, payload: { payment_id: payments.find((p) => p.status === "UNMATCHED")?.id, confidence: 0.75 } }),
    A({ customer: 4, invoice: "INV-2026-00170", type: "PAYMENT_MATCHED", status: "COMPLETED", severity: "SUCCESS", title: "Ödeme eşleştirildi: ₺90.000,00 → INV-2026-00170", description: "Anadolu Otomotiv Yedek Parça (kısmi)", daysAgo: 4 }),
    A({ customer: 6, invoice: "INV-2026-00194", comm: pendingDraft?.id ?? null, type: "REMINDER_DRAFTED", status: "PENDING_APPROVAL", severity: "INFO", title: "Hatırlatma taslağı: Baltic Foods OÜ · INV-2026-00194", description: `Vade öncesi · ${money("INV-2026-00194")}`, daysAgo: 0 }),
  ] as never);

  // Risk scores
  const allInvoices = await store.list("invoices");
  const allPromises = await store.list("payment_promises");
  for (const c of customers) {
    const fin = computeCustomerFinancials(c, allInvoices, payments, allPromises, asOf);
    const r = computeRiskScore(fin, { creditLimit: c.credit_limit, locale: "tr" });
    // Six months of plausible history ending at today's score, so the trend chart is meaningful.
    const drift = [18, 12, 9, 6, 3, 0];
    const history = drift.map((back, idx) => {
      const dt = new Date(`${asOf}T00:00:00Z`);
      dt.setUTCDate(1);
      dt.setUTCMonth(dt.getUTCMonth() - (drift.length - 1 - idx));
      const score = Math.max(0, Math.min(100, Math.round(r.score - back * (r.score >= 50 ? 1 : -0.4))));
      return { month: dt.toISOString().slice(0, 7), score, grade: gradeForScore(score), note: null as string | null };
    });
    for (let i = 1; i < history.length; i++) if (history[i].grade !== history[i - 1].grade) history[i].note = `${history[i - 1].grade} → ${history[i].grade}`;
    await store.insert("risk_scores", { customer_id: c.id, score: r.score, level: r.level, grade: r.grade, reasons: r.reasons, facts: r.facts, recommendation: r.recommendation, factors: r.factors, history, computed_at: nowIso });
  }

  await store.insert("audit_logs", { user_id: opts.ownerUserId, action: "demo.seeded", entity_type: "organization", entity_id: org.id, details: { customers: customers.length, invoices: invoices.length, payments: payments.length } });
}
