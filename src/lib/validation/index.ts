import { z } from "zod";
import { CHANNELS, CURRENCIES, INVOICE_STATUSES, TONES } from "@/lib/types";
import { normalizeDateInput } from "@/lib/domain/dates";
import { parseAmount } from "@/lib/domain/money";

export const localeSchema = z.enum(["tr", "en"]);
export const currencySchema = z.enum(CURRENCIES);

const dateInput = z
  .string()
  .trim()
  .transform((s, ctx) => {
    const n = normalizeDateInput(s);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Geçersiz tarih / invalid date (YYYY-MM-DD)" });
      return z.NEVER;
    }
    return n;
  });

const amountInput = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const n = parseAmount(v);
  if (n === null) {
    ctx.addIssue({ code: "custom", message: "Geçersiz tutar / invalid amount" });
    return z.NEVER;
  }
  return n;
});

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : null));

export const customerSchema = z.object({
  company_name: z.string().trim().min(2).max(200),
  contact_person: optionalText,
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.string().email().nullable()),
  phone: optionalText,
  whatsapp_number: optionalText,
  country: optionalText,
  preferred_language: localeSchema.default("tr"),
  payment_terms_days: z.coerce.number().int().min(0).max(365).default(30),
  credit_limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : parseAmount(v))),
  currency: currencySchema.default("TRY"),
  notes: optionalText,
});
export type CustomerInput = z.infer<typeof customerSchema>;

export const invoiceSchema = z
  .object({
    customer_id: z.string().min(1),
    invoice_number: z.string().trim().min(1).max(64),
    invoice_date: dateInput,
    due_date: dateInput,
    currency: currencySchema,
    amount: amountInput.pipe(z.number().positive().max(1e12)),
    paid_amount: amountInput.pipe(z.number().min(0).max(1e12)).default(0),
    description: optionalText,
    status: z.enum(INVOICE_STATUSES).optional(),
  })
  .refine((v) => v.due_date >= v.invoice_date, { message: "Vade tarihi fatura tarihinden önce olamaz", path: ["due_date"] })
  .refine((v) => v.paid_amount <= v.amount, { message: "Ödenen tutar fatura tutarını aşamaz", path: ["paid_amount"] });
export type InvoiceInput = z.infer<typeof invoiceSchema>;

/** One row of the invoice CSV import. */
export const invoiceCsvRowSchema = z.object({
  invoice_number: z.string().trim().min(1).max(64),
  customer: z.string().trim().min(1).max(200),
  customer_email: z
    .string()
    .trim()
    .optional()
    .default("")
    .transform((v) => (v ? v : null))
    .pipe(z.string().email().nullable()),
  customer_phone: z.string().trim().optional().default("").transform((v) => (v ? v : null)),
  invoice_date: dateInput,
  due_date: dateInput,
  currency: z.string().trim().toUpperCase().pipe(currencySchema),
  amount: amountInput.pipe(z.number().positive()),
  paid_amount: z
    .union([z.string(), z.number()])
    .optional()
    .default(0)
    .transform((v) => (v === "" || v === undefined ? 0 : (parseAmount(v) ?? Number.NaN)))
    .pipe(z.number().min(0)),
});
export type InvoiceCsvRow = z.infer<typeof invoiceCsvRowSchema>;

export const bankCsvRowSchema = z.object({
  transaction_date: dateInput,
  description: z.string().trim().optional().default("").transform((v) => (v ? v : null)),
  reference: z.string().trim().optional().default("").transform((v) => (v ? v : null)),
  amount: amountInput,
  currency: z.string().trim().toUpperCase().pipe(currencySchema),
});
export type BankCsvRow = z.infer<typeof bankCsvRowSchema>;

export const paymentSchema = z.object({
  customer_id: z.string().optional().transform((v) => (v ? v : null)),
  payment_date: dateInput,
  amount: amountInput.pipe(z.number().positive()),
  currency: currencySchema,
  reference: optionalText,
  matched_invoice_id: z.string().optional().transform((v) => (v ? v : null)),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const automationSchema = z.object({
  pre_due_enabled: z.boolean(),
  pre_due_days: z.coerce.number().int().min(1).max(30),
  due_date_enabled: z.boolean(),
  overdue_enabled: z.boolean(),
  first_reminder_days: z.coerce.number().int().min(1).max(60),
  second_reminder_days: z.coerce.number().int().min(2).max(90),
  escalation_days: z.coerce.number().int().min(3).max(180),
  channels: z.array(z.enum(CHANNELS)).min(1),
  require_approval: z.boolean(),
  auto_send_pre_due: z.boolean(),
  sales_involved_after_days: z.coerce.number().int().min(0).max(180),
}).refine((v) => v.first_reminder_days < v.second_reminder_days && v.second_reminder_days < v.escalation_days, {
  message: "Hatırlatma günleri artan sırada olmalı (1. < 2. < eskalasyon)",
  path: ["escalation_days"],
});
export type AutomationInput = z.infer<typeof automationSchema>;

export const companySettingsSchema = z.object({
  name: z.string().trim().min(2).max(200),
  logo_url: z.string().trim().url().optional().or(z.literal("")).transform((v) => (v ? v : null)),
  address: optionalText,
  tax_number: optionalText,
  default_currency: currencySchema,
  reporting_currency: currencySchema,
  default_payment_terms_days: z.coerce.number().int().min(0).max(365),
  language: localeSchema,
  fx_eur: z.coerce.number().positive().optional(),
  fx_usd: z.coerce.number().positive().optional(),
  fx_gbp: z.coerce.number().positive().optional(),
  approval_amount_threshold: z.coerce.number().min(0).max(1e12).optional(),
});

export const gradeRulesSchema = z.object({
  A: z.string().trim().min(3).max(300),
  B: z.string().trim().min(3).max(300),
  C: z.string().trim().min(3).max(300),
  D: z.string().trim().min(3).max(300),
  E: z.string().trim().min(3).max(300),
});

export const aiSettingsSchema = z.object({
  ai_auto_send: z.boolean(),
  ai_confidence_threshold: z.coerce.number().min(0.5).max(0.99),
  ai_default_tone: z.enum(TONES),
  ai_signature: optionalText,
});

export const communicationSettingsSchema = z.object({
  sender_name: optionalText,
  sender_email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.string().email().nullable()),
  whatsapp_number: optionalText,
});

export const signUpSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

export const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(200),
  default_currency: currencySchema.default("TRY"),
  default_payment_terms_days: z.coerce.number().int().min(0).max(365).default(30),
  language: localeSchema.default("tr"),
  load_demo_data: z.boolean().default(false),
});

/** Flattens Zod issues to `field: message` for forms. */
export function issuesToMessage(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join(".") || "form"}: ${i.message}`).join("; ");
}
