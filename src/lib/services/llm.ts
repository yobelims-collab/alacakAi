import "server-only";
import { hasOpenAI } from "@/lib/env";
import { callStructured } from "@/lib/ai/openai-client";
import { classificationOutputSchema, generatedMessageSchema, type ClassificationOutput, type GeneratedMessage } from "@/lib/ai/schemas";

/** Adapters that the pure AI modules accept; `null` means "no model configured → rules only". */
export function messageLlm(): ((system: string, user: string) => Promise<GeneratedMessage | null>) | null {
  if (!hasOpenAI()) return null;
  return async (system, user) => (await callStructured(generatedMessageSchema, system, user, { temperature: 0.4 })).data;
}

export function classifierLlm(): ((system: string, user: string) => Promise<ClassificationOutput | null>) | null {
  if (!hasOpenAI()) return null;
  return async (system, user) => (await callStructured(classificationOutputSchema, system, user, { temperature: 0 })).data;
}
