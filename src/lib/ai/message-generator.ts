import type { CollectionStage, Locale, Tone } from "@/lib/types";
import { formatDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { generatedMessageSchema, type GeneratedMessage } from "./schemas";
import { COLLECTION_SYSTEM_PROMPT, FORBIDDEN_PHRASES } from "./system-prompt";
import { defaultToneForStage, renderPromiseFollowUp, renderTemplate, type TemplateFacts } from "./templates";

export interface MessageGeneratorInput {
  facts: TemplateFacts;
  stage: CollectionStage;
  language: Locale;
  tone?: Tone;
  /** Short bullet list of prior interactions, e.g. "Promised payment on 2026-09-25 (broken)". */
  history?: string[];
  /** Special follow-up when a promise date passed without payment. */
  promiseFollowUp?: boolean;
}

export interface MessageGeneratorResult extends GeneratedMessage {
  generator: "template" | "llm";
}

type StructuredCaller = (system: string, user: string) => Promise<GeneratedMessage | null>;

/** Safety net applied to *every* candidate message (LLM or human-edited). */
export function validateOutboundMessage(msg: { subject: string; body: string }, facts: TemplateFacts): string[] {
  const problems: string[] = [];
  const text = `${msg.subject}\n${msg.body}`.toLocaleLowerCase("tr");
  for (const phrase of FORBIDDEN_PHRASES) {
    if (text.includes(phrase)) problems.push(`forbidden phrase: "${phrase}"`);
  }
  if (!text.includes(facts.invoiceNumber.toLocaleLowerCase("tr"))) problems.push("invoice number missing");
  const digits = String(Math.round(facts.amount));
  const bodyDigits = text.replace(/[^\d]/g, "");
  if (!bodyDigits.includes(digits)) problems.push("invoice amount missing");
  if (msg.body.length > 2500) problems.push("message too long");
  return problems;
}

/**
 * Produces subject/body/tone for a collection stage.
 * Template first (always valid), then optionally asks the model to write a more contextual
 * version; the model output is Zod-validated and checked against the facts. On any failure the
 * template wins, so the caller always gets a safe message.
 */
export async function generateMessage(
  input: MessageGeneratorInput,
  llm: StructuredCaller | null,
): Promise<MessageGeneratorResult> {
  const tone = input.tone ?? defaultToneForStage(input.stage);
  const template = input.promiseFollowUp
    ? renderPromiseFollowUp(input.facts, input.language)
    : renderTemplate(input.stage, tone, input.facts, input.language);
  const fallback: MessageGeneratorResult = { ...template, tone, generator: "template" };
  if (!llm) return fallback;

  const f = input.facts;
  const user = [
    `Write a ${tone} ${input.language === "tr" ? "Turkish" : "English"} collection message for stage ${input.stage}.`,
    `Customer company: ${f.customerName}`,
    `Contact person: ${f.contactName ?? "(unknown, use a neutral greeting)"}`,
    `Our company: ${f.companyName}`,
    `Invoice number: ${f.invoiceNumber}`,
    `Amount: ${formatMoney(f.amount, f.currency, input.language)} (${f.amount} ${f.currency})`,
    `Due date: ${formatDate(f.dueDate, input.language)} (${f.dueDate})`,
    `Days overdue: ${f.daysOverdue}`,
    f.promisedDate ? `Customer previously promised payment on ${f.promisedDate}.` : "",
    input.history?.length ? `Relevant history:\n- ${input.history.join("\n- ")}` : "",
    `Signature to use: ${f.signature?.trim() || f.companyName}`,
    `A reviewed reference version of this message (keep the same facts, you may improve wording and adapt to history):\nSubject: ${template.subject}\n${template.body}`,
    `Return JSON: {"subject": string, "body": string, "tone": "${tone}"}. Body must include the invoice number and the amount, be under 900 characters, and ask for a payment date when overdue.`,
  ]
    .filter(Boolean)
    .join("\n");

  const out = await llm(COLLECTION_SYSTEM_PROMPT, user);
  if (!out) return fallback;
  const parsed = generatedMessageSchema.safeParse(out);
  if (!parsed.success) return fallback;
  if (validateOutboundMessage(parsed.data, f).length > 0) return fallback;
  return { ...parsed.data, tone, generator: "llm" };
}
