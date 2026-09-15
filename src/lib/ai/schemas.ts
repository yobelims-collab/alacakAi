import { z } from "zod";
import { INTENTS, TONES, URGENCIES } from "@/lib/types";

/** Structured output of the message generator (LLM or template). */
export const generatedMessageSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(20).max(2500),
  tone: z.enum(TONES),
});
export type GeneratedMessage = z.infer<typeof generatedMessageSchema>;

/** Structured output of the reply classifier. */
export const classificationOutputSchema = z.object({
  intent: z.enum(INTENTS),
  confidence: z.number().min(0).max(1),
  promised_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  requested_extension_days: z.number().int().min(0).max(365).nullable().default(null),
  disputed_amount: z.number().min(0).nullable().default(null),
  reason: z.string().max(500).nullable().default(null),
  urgency: z.enum(URGENCIES).default("MEDIUM"),
  summary: z.string().max(300),
});
export type ClassificationOutput = z.infer<typeof classificationOutputSchema>;
