import { AutomationForm } from "@/components/settings/automation-form";
import { requireContext } from "@/lib/db";
import { getAutomationRules } from "@/lib/services/collection-service";

export const metadata = { title: "Automation settings" };

export default async function AutomationSettingsPage() {
  const ctx = await requireContext();
  const rules = await getAutomationRules(ctx.store);
  return <AutomationForm rules={rules} t={ctx.t} locale={ctx.locale} />;
}
