import "server-only";
import OpenAI from "openai";
import type { z } from "zod";
import { env, hasOpenAI } from "@/lib/env";

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!hasOpenAI()) return null;
  if (!client) client = new OpenAI({ apiKey: env.openaiApiKey });
  return client;
}

export interface StructuredCallResult<T> {
  data: T | null;
  /** Why `data` is null: no key, transport error, or output failed validation. */
  error: "not_configured" | "request_failed" | "invalid_output" | null;
}

/**
 * Calls the model in JSON mode and validates the output with a Zod schema.
 * Financial state is only ever changed from the *validated* object, never from raw text.
 */
export async function callStructured<S extends z.ZodTypeAny>(
  schema: S,
  system: string,
  user: string,
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<StructuredCallResult<z.infer<S>>> {
  const openai = getClient();
  if (!openai) return { data: null, error: "not_configured" };
  try {
    const res = await openai.chat.completions.create({
      model: env.openaiModel,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const text = res.choices[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { data: null, error: "invalid_output" };
    }
    const result = schema.safeParse(parsed);
    if (!result.success) return { data: null, error: "invalid_output" };
    return { data: result.data, error: null };
  } catch {
    return { data: null, error: "request_failed" };
  }
}
