/**
 * Domain types for Alacore.
 *
 * Every row type mirrors a PostgreSQL table in `supabase/schema.sql` (snake_case columns)
 * so the same shapes flow through the in-memory demo store and the Supabase store.
 * Dates are ISO strings: `YYYY-MM-DD` for calendar dates, full ISO for timestamps.
 */

export type Locale = "tr" | "en";
export type Currency = "TRY" | "EUR" | "USD" | "GBP";

export const CURRENCIES: Currency[] = ["TRY", "EUR", "USD", "GBP"];

export const INVOICE_STATUSES = [
  "DRAFT",
  "SENT",
  "DUE_SOON",
  "DUE_TODAY",
  "OVERDUE",
  "PAYMENT_PROMISED",
  "PARTIALLY_PAID",
  "PAID",
  "DISPUTED",
  "ESCALATED",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Terminal / human-controlled statuses are never overwritten by date-based derivation. */
export const STICKY_INVOICE_STATUSES: InvoiceStatus[] = [
  "DRAFT",
  "PAID",
  "DISPUTED",
  "ESCALATED",
  "PAYMENT_PROMISED",
  "PARTIALLY_PAID",
];

export const COLLECTION_STAGES = [
  "NONE",
  "PRE_DUE",
  "DUE_TODAY",
  "OVERDUE_EARLY",
  "OVERDUE_MID",
  "ESCALATED",
] as const;
export type CollectionStage = (typeof COLLECTION_STAGES)[number];

export const PAYMENT_STATUSES = ["UNMATCHED", "MATCHED", "PARTIAL", "REFUND"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PROMISE_STATUSES = ["ACTIVE", "KEPT", "BROKEN", "CANCELLED"] as const;
export type PromiseStatus = (typeof PROMISE_STATUSES)[number];

export const CHANNELS = ["EMAIL", "WHATSAPP"] as const;
export type Channel = (typeof CHANNELS)[number];

export const COMMUNICATION_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "SENT_SIMULATED",
  "SENT",
  "RECEIVED",
  "REJECTED",
  "FAILED",
] as const;
export type CommunicationStatus = (typeof COMMUNICATION_STATUSES)[number];

export const TONES = ["POLITE", "PROFESSIONAL", "FIRM"] as const;
export type Tone = (typeof TONES)[number];

export const INTENTS = [
  "PAYMENT_CONFIRMED",
  "PAYMENT_DATE_PROMISED",
  "WAITING_FOR_APPROVAL",
  "CASH_FLOW_PROBLEM",
  "INVOICE_NOT_RECEIVED",
  "DISPUTE",
  "PRODUCT_OR_SHIPMENT_PROBLEM",
  "REQUEST_EXTENSION",
  "REFUSAL_TO_PAY",
  "WRONG_CONTACT",
  "OTHER",
] as const;
export type Intent = (typeof INTENTS)[number];

export const URGENCIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/** Customer rating letter shown everywhere in the UI. A = pays on time … E = stop list. */
export const GRADES = ["A", "B", "C", "D", "E"] as const;
export type Grade = (typeof GRADES)[number];

/** Who has to look at an item in the inbox. */
export type Audience = "FINANCE" | "SALES" | "BOTH";

export const AI_ACTION_TYPES = [
  "REMINDER_DRAFTED",
  "REMINDER_SENT",
  "REPLY_CLASSIFIED",
  "PROMISE_RECORDED",
  "PROMISE_KEPT",
  "PROMISE_BROKEN",
  "PAYMENT_MATCHED",
  "PAYMENT_MATCH_SUGGESTED",
  "ESCALATION",
  "RISK_UPDATED",
  "INVOICE_STATUS_CHANGED",
] as const;
export type AiActionType = (typeof AI_ACTION_TYPES)[number];

export const AI_ACTION_STATUSES = [
  "COMPLETED",
  "PENDING_APPROVAL",
  "NEEDS_HUMAN",
  "RESOLVED",
  "REJECTED",
] as const;
export type AiActionStatus = (typeof AI_ACTION_STATUSES)[number];

export const SEVERITIES = ["INFO", "SUCCESS", "WARNING", "CRITICAL"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const USER_ROLES = ["OWNER", "ADMIN", "FINANCE", "SALES", "VIEWER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type BankTransactionStatus = "UNMATCHED" | "MATCHED" | "IGNORED";

export interface BaseRow {
  id: string;
  created_at: string;
}

export interface OrgRow extends BaseRow {
  organization_id: string;
}

export interface Organization extends BaseRow {
  name: string;
  logo_url: string | null;
  address: string | null;
  tax_number: string | null;
  default_currency: Currency;
  /** Currency in which dashboard totals are reported. */
  reporting_currency: Currency;
  /** Rates from currency -> reporting currency. Editable in settings; never fetched live in the MVP. */
  fx_rates: Record<string, number>;
  default_payment_terms_days: number;
  language: Locale;
  is_demo: boolean;
  /** AI settings */
  ai_auto_send: boolean;
  ai_confidence_threshold: number;
  ai_default_tone: Tone;
  ai_signature: string | null;
  /** Communication settings */
  sender_name: string | null;
  sender_email: string | null;
  whatsapp_number: string | null;
  /** Company rule shown next to each rating letter (what a new employee should do). */
  grade_rules: Record<Grade, string>;
  /** Amount (reporting currency) above which even pre-due reminders need a human. */
  approval_amount_threshold: number;
}

export interface Profile extends OrgRow {
  email: string;
  full_name: string;
  role: UserRole;
}

export interface Customer extends OrgRow {
  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  country: string | null;
  preferred_language: Locale;
  payment_terms_days: number;
  credit_limit: number | null;
  currency: Currency;
  notes: string | null;
  account_manager_id: string | null;
  /** Human decision: no new shipments until cleared. */
  shipments_on_hold: boolean;
}

export interface CustomerContact extends OrgRow {
  customer_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_primary: boolean;
}

export interface Invoice extends OrgRow {
  customer_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  currency: Currency;
  amount: number;
  paid_amount: number;
  status: InvoiceStatus;
  collection_stage: CollectionStage;
  assigned_user_id: string | null;
  description: string | null;
  /** Last collection stage the engine acted on, prevents duplicate reminders. */
  last_reminder_stage: CollectionStage | null;
  last_reminder_at: string | null;
  updated_at: string;
  /** Storage path of the attached invoice PDF (sent with reminders), if any. */
  document_path: string | null;
  document_name: string | null;
  /** e-Fatura ETTN (UUID) when imported from UBL-TR XML; used to skip duplicates. */
  external_ref: string | null;
  source: "MANUAL" | "CSV" | "EFATURA" | "DEMO";
}

export interface Payment extends OrgRow {
  customer_id: string | null;
  payment_date: string;
  amount: number;
  currency: Currency;
  reference: string | null;
  matched_invoice_id: string | null;
  status: PaymentStatus;
  source: "MANUAL" | "BANK_IMPORT" | "DEMO";
  bank_transaction_id: string | null;
  /** AI suggestion, kept until a human matches or rejects. */
  suggested_invoice_id: string | null;
  suggested_confidence: number | null;
  suggestion_reasons: string[] | null;
}

export interface PaymentPromise extends OrgRow {
  customer_id: string;
  invoice_id: string;
  promised_date: string;
  amount: number | null;
  currency: Currency;
  status: PromiseStatus;
  source_communication_id: string | null;
  notes: string | null;
  resolved_at: string | null;
}

export interface Classification {
  intent: Intent;
  confidence: number;
  promised_date: string | null;
  requested_extension_days: number | null;
  disputed_amount: number | null;
  reason: string | null;
  urgency: Urgency;
  requires_human: boolean;
  summary: string;
  /** "llm" when produced by the model, "rules" when produced by the deterministic fallback. */
  engine: "llm" | "rules";
}

export interface Communication extends OrgRow {
  customer_id: string;
  invoice_id: string | null;
  channel: Channel;
  direction: "OUTBOUND" | "INBOUND";
  subject: string | null;
  body: string;
  language: Locale;
  stage: CollectionStage | null;
  tone: Tone | null;
  status: CommunicationStatus;
  classification: Classification | null;
  /** True when the message was produced by the AI (vs typed by a user). */
  ai_generated: boolean;
  /** "template" | "llm" – which engine wrote the outbound draft. */
  generator: "template" | "llm" | "human" | null;
  sent_at: string | null;
  provider_message_id: string | null;
  next_action_at: string | null;
  next_action_note: string | null;
  /** For AI drafts that answer a customer message: id of the inbound communication. */
  in_reply_to: string | null;
  /** Two alternative wordings the human can pick from (decision cards). */
  alternatives: { soft: { subject: string; body: string }; firm: { subject: string; body: string } } | null;
  /** Hidden from the inbox until this date. */
  snoozed_until: string | null;
  routed_to: Audience | null;
  /** Reason the draft needs a human (null when it is a routine reminder). */
  approval_reason: string | null;
}

export interface AiAction extends OrgRow {
  customer_id: string | null;
  invoice_id: string | null;
  communication_id: string | null;
  type: AiActionType;
  status: AiActionStatus;
  severity: Severity;
  title: string;
  description: string | null;
  recommended_action: string | null;
  payload: Record<string, unknown> | null;
  resolved_at: string | null;
  resolved_by: string | null;
  routed_to: Audience | null;
  /** Human decision taken on a NEEDS_HUMAN card. */
  decision: string | null;
}

export interface RiskHistoryPoint {
  month: string; // YYYY-MM
  score: number;
  grade: Grade;
  note: string | null;
}

export interface RiskScore extends OrgRow {
  customer_id: string;
  score: number;
  level: RiskLevel;
  grade: Grade;
  reasons: string[];
  /** Plain-language facts for a new employee ("Pays 12 days late on average"). */
  facts: string[];
  recommendation: string;
  factors: Record<string, number>;
  history: RiskHistoryPoint[];
  computed_at: string;
}

export interface AutomationRule extends OrgRow {
  pre_due_enabled: boolean;
  pre_due_days: number;
  due_date_enabled: boolean;
  overdue_enabled: boolean;
  first_reminder_days: number;
  second_reminder_days: number;
  escalation_days: number;
  channels: Channel[];
  require_approval: boolean;
  /** The only thing the AI sends on its own: reminders before the due date. */
  auto_send_pre_due: boolean;
  /** From this many days overdue the account manager (sales) is looped in. */
  sales_involved_after_days: number;
}

export interface BankTransaction extends OrgRow {
  transaction_date: string;
  description: string | null;
  reference: string | null;
  amount: number;
  currency: Currency;
  status: BankTransactionStatus;
  matched_invoice_id: string | null;
  payment_id: string | null;
}

export interface AuditLog extends OrgRow {
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
}

export interface TableMap {
  organizations: Organization;
  profiles: Profile;
  customers: Customer;
  customer_contacts: CustomerContact;
  invoices: Invoice;
  payments: Payment;
  payment_promises: PaymentPromise;
  communications: Communication;
  ai_actions: AiAction;
  risk_scores: RiskScore;
  automation_rules: AutomationRule;
  bank_transactions: BankTransaction;
  audit_logs: AuditLog;
}
export type TableName = keyof TableMap;
export type OrgTableName = Exclude<TableName, "organizations">;

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  organization_id: string | null;
  role: UserRole;
  /** "demo" = in-memory session (no Supabase), "supabase" = real auth. */
  provider: "demo" | "supabase";
}
