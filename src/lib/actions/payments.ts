"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireContext } from "@/lib/db";
import { validateBankCsv, type CsvValidation } from "@/lib/services/import-service";
import { importBankTransactions, matchPayment, recordPayment, rejectSuggestion } from "@/lib/services/payment-service";
import { issuesToMessage, paymentSchema, type BankCsvRow } from "@/lib/validation";
import type { FormState } from "./customers";
import type { ActionResult } from "./collection";

function revalidate() {
  for (const p of ["/payments", "/invoices", "/customers", "/dashboard", "/ai-actions", "/attention"]) revalidatePath(p, "layout");
}

export async function createPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: issuesToMessage(parsed.error) };
  const ctx = await requireContext();
  try {
    await recordPayment(ctx, parsed.data, "MANUAL");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "failed" };
  }
  revalidate();
  redirect("/payments");
}

export async function matchPaymentAction(paymentId: string, invoiceId: string): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    await matchPayment(ctx, z.string().min(1).parse(paymentId), z.string().min(1).parse(invoiceId));
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" };
  }
}

export async function rejectSuggestionAction(paymentId: string): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    await rejectSuggestion(ctx, z.string().min(1).parse(paymentId));
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" };
  }
}

export async function validateBankCsvAction(text: string): Promise<CsvValidation<BankCsvRow>> {
  await requireContext();
  return validateBankCsv(text.slice(0, 2_000_000));
}

export async function importBankCsvAction(text: string): Promise<ActionResult<{ imported: number; suggested: number; skipped: number }>> {
  try {
    const ctx = await requireContext();
    const v = validateBankCsv(text.slice(0, 2_000_000));
    if (v.valid.length === 0) return { ok: false, error: "No valid rows" };
    const data = await importBankTransactions(ctx, v.valid.map((x) => x.data));
    revalidate();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" };
  }
}
