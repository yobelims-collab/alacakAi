import Link from "next/link";
import { PageHeader, StatCard } from "@/components/app/page-header";
import { RunCycleButton } from "@/components/app/run-cycle-button";
import { ActivityFeed } from "@/components/inbox/activity-feed";
import { FadeIn } from "@/components/app/motion";
import { DecisionCard } from "@/components/inbox/decision-card";
import { QuickList } from "@/components/inbox/quick-list";
import { Button } from "@/components/ui/button";
import { requireContext } from "@/lib/db";
import { formatMoney } from "@/lib/domain/money";
import { loadInbox } from "@/lib/inbox";
import { loadDashboard } from "@/lib/queries";

export const metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ mine?: string }> }) {
  const ctx = await requireContext();
  const { t, locale, org } = ctx;
  const sp = await searchParams;
  const onlyMine = sp.mine === "1";
  const [inbox, dash, recent, customers] = await Promise.all([loadInbox(ctx, { onlyMine }), loadDashboard(ctx), ctx.store.list("ai_actions", { limit: 12 }), ctx.store.list("customers")]);
  const customerNames = Object.fromEntries(customers.map((c) => [c.id, c.company_name]));
  const money = (n: number) => formatMoney(n, org.reporting_currency, locale, { compact: true });

  return (
    <>
      <PageHeader
        title={t.inbox.title}
        subtitle={t.inbox.subtitle}
        actions={
          <>
            <span className="inline-flex rounded-md border p-0.5 text-xs">
              <Button asChild size="sm" variant={onlyMine ? "ghost" : "default"} className="h-7">
                <Link href="/inbox">{t.inbox.all}</Link>
              </Button>
              <Button asChild size="sm" variant={onlyMine ? "default" : "ghost"} className="h-7">
                <Link href="/inbox?mine=1">{t.inbox.forMe}</Link>
              </Button>
            </span>
            <RunCycleButton t={t} variant="outline" />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label={t.inbox.decisions} value={String(inbox.decisions.length)} tone={inbox.decisions.length ? "critical" : "default"} />
        <StatCard label={t.inbox.quick} value={String(inbox.quick.length)} tone={inbox.quick.length ? "warning" : "default"} />
        <StatCard label={t.inbox.autoSentToday} value={String(inbox.autoSentToday)} hint={t.inbox.remindersSentByAi} />
        <StatCard label={t.dashboard.overdue} value={money(dash.metrics.overdue)} hint={`${dash.metrics.overdueCount} ${t.dashboard.overdueCount}`} />
        <StatCard label={t.dashboard.totalReceivables} value={money(dash.metrics.totalReceivables)} hint={`${dash.metrics.openCount} ${t.dashboard.openInvoices}`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {inbox.totalWaiting === 0 && <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{t.inbox.empty}</p>}

          {inbox.decisions.length > 0 && (
            <FadeIn>
              <section>
                <h2 className="text-base font-semibold">{t.inbox.decisions}</h2>
                <p className="mb-3 text-xs text-muted-foreground">{t.inbox.decisionsHint}</p>
                <ul className="flex flex-col gap-3">
                  {inbox.decisions.map((d) => (
                    <DecisionCard key={d.action.id} item={d} t={t} locale={locale} />
                  ))}
                </ul>
              </section>
            </FadeIn>
          )}

          {inbox.quick.length > 0 && (
            <FadeIn delay={0.08}>
              <section className={inbox.decisions.length ? "mt-8" : ""}>
                <h2 className="text-base font-semibold">{t.inbox.quick}</h2>
                <p className="mb-3 text-xs text-muted-foreground">{t.inbox.quickHint}</p>
                <QuickList items={inbox.quick} t={t} locale={locale} />
              </section>
            </FadeIn>
          )}
        </div>
        <aside className="xl:sticky xl:top-20 xl:self-start">
          <ActivityFeed actions={recent} customers={customerNames} t={t} locale={locale} />
        </aside>
      </div>
    </>
  );
}
