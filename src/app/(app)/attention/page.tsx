import { AttentionList } from "@/components/app/attention-list";
import { PageHeader } from "@/components/app/page-header";
import { RunCycleButton } from "@/components/app/run-cycle-button";
import { requireContext } from "@/lib/db";
import { loadDashboard } from "@/lib/queries";

export const metadata = { title: "Human attention" };

export default async function AttentionPage() {
  const ctx = await requireContext();
  const { attention } = await loadDashboard(ctx);
  return (
    <>
      <PageHeader title={ctx.t.dashboard.humanAttention} subtitle={`${attention.length}`} actions={<RunCycleButton t={ctx.t} variant="outline" />} />
      <AttentionList items={attention} t={ctx.t} locale={ctx.locale} />
    </>
  );
}
