"use server";

import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/db";
import { denyManage } from "@/lib/services/team-service";
import { audit } from "@/lib/services/audit";
import { getAutomationRules } from "@/lib/services/collection-service";
import type { Channel } from "@/lib/types";
import { aiSettingsSchema, automationSchema, communicationSettingsSchema, companySettingsSchema, gradeRulesSchema, issuesToMessage } from "@/lib/validation";
import type { FormState } from "./customers";

const on = (v: FormDataEntryValue | null) => v === "on" || v === "true";

export async function updateCompanyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = companySettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: issuesToMessage(parsed.error) };
  const ctx = await requireContext();
  const denied = denyManage(ctx); if (denied) return denied;
  const { fx_eur, fx_usd, fx_gbp, approval_amount_threshold, ...rest } = parsed.data;
  const fx: Record<string, number> = { ...ctx.org.fx_rates, TRY: 1 };
  if (fx_eur) fx.EUR = fx_eur;
  if (fx_usd) fx.USD = fx_usd;
  if (fx_gbp) fx.GBP = fx_gbp;
  await ctx.store.updateOrganization({ ...rest, fx_rates: fx, ...(approval_amount_threshold !== undefined ? { approval_amount_threshold } : {}) });
  await audit(ctx.store, { user_id: ctx.user.id, action: "settings.company", entity_type: "organization", entity_id: ctx.org.id });
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateAiSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = aiSettingsSchema.safeParse({
    ai_auto_send: on(formData.get("ai_auto_send")),
    ai_confidence_threshold: formData.get("ai_confidence_threshold"),
    ai_default_tone: formData.get("ai_default_tone"),
    ai_signature: formData.get("ai_signature") ?? undefined,
  });
  if (!parsed.success) return { error: issuesToMessage(parsed.error) };
  const ctx = await requireContext();
  const denied = denyManage(ctx); if (denied) return denied;
  await ctx.store.updateOrganization(parsed.data);
  await audit(ctx.store, { user_id: ctx.user.id, action: "settings.ai", entity_type: "organization", entity_id: ctx.org.id });
  revalidatePath("/settings", "layout");
  return { success: true };
}

export async function updateCommunicationSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = communicationSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: issuesToMessage(parsed.error) };
  const ctx = await requireContext();
  const denied = denyManage(ctx); if (denied) return denied;
  await ctx.store.updateOrganization(parsed.data);
  await audit(ctx.store, { user_id: ctx.user.id, action: "settings.communication", entity_type: "organization", entity_id: ctx.org.id });
  revalidatePath("/settings", "layout");
  return { success: true };
}

export async function updateAutomationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const channels = (["EMAIL", "WHATSAPP"] as Channel[]).filter((c) => on(formData.get(`channel_${c}`)));
  const parsed = automationSchema.safeParse({
    pre_due_enabled: on(formData.get("pre_due_enabled")),
    pre_due_days: formData.get("pre_due_days"),
    due_date_enabled: on(formData.get("due_date_enabled")),
    overdue_enabled: on(formData.get("overdue_enabled")),
    first_reminder_days: formData.get("first_reminder_days"),
    second_reminder_days: formData.get("second_reminder_days"),
    escalation_days: formData.get("escalation_days"),
    channels,
    require_approval: on(formData.get("require_approval")),
    auto_send_pre_due: on(formData.get("auto_send_pre_due")),
    sales_involved_after_days: formData.get("sales_involved_after_days") ?? 14,
  });
  if (!parsed.success) return { error: issuesToMessage(parsed.error) };
  const ctx = await requireContext();
  const denied = denyManage(ctx); if (denied) return denied;
  const rules = await getAutomationRules(ctx.store);
  await ctx.store.update("automation_rules", rules.id, parsed.data);
  await audit(ctx.store, { user_id: ctx.user.id, action: "settings.automation", entity_type: "automation_rule", entity_id: rules.id });
  revalidatePath("/settings", "layout");
  return { success: true };
}

export async function updateGradeRulesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = gradeRulesSchema.safeParse({ A: formData.get("A"), B: formData.get("B"), C: formData.get("C"), D: formData.get("D"), E: formData.get("E") });
  if (!parsed.success) return { error: issuesToMessage(parsed.error) };
  const ctx = await requireContext();
  const denied = denyManage(ctx); if (denied) return denied;
  await ctx.store.updateOrganization({ grade_rules: parsed.data });
  await audit(ctx.store, { user_id: ctx.user.id, action: "settings.grade_rules", entity_type: "organization", entity_id: ctx.org.id });
  revalidatePath("/", "layout");
  return { success: true };
}
