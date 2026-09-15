import Link from "next/link";
import { Filter } from "lucide-react";
import { EmptyState, PageHeader, StatCard } from "@/components/app/page-header";
import { RunCycleButton } from "@/components/app/run-cycle-button";
import { ActionStatusBadge, SeverityIcon } from "@/components/app/status-badge";
import { ResolveButton } from "@/components/ai-actions/resolve-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireContext } from "@/lib/db";
import { formatDateTime } from "@/lib/domain/dates";
import { AI_ACTION_STATUSES, AI_ACTION_TYPES, type AiActionStatus, type AiActionType } from "@/lib/types";

export const metadata = { title: "AI actions" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const LOCAL = {
  tr: { apply: "Filtrele", clear: "Temizle", from: "Başlangıç", to: "Bitiş", action: "İşlem", results: "kayıt" },
  en: { apply: "Apply", clear: "Clear", from: "From", to: "To", action: "Action", results: "records" },
};

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function AiActionsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const { t, locale } = ctx;
  const L = LOCAL[locale];

  const f = {
    customer: first(sp.customer),
    invoice: first(sp.invoice).trim(),
    type: AI_ACTION_TYPES.includes(first(sp.type) as AiActionType) ? (first(sp.type) as AiActionType) : "",
    status: AI_ACTION_STATUSES.includes(first(sp.status) as AiActionStatus) ? (first(sp.status) as AiActionStatus) : "",
    from: /^\d{4}-\d{2}-\d{2}$/.test(first(sp.from)) ? first(sp.from) : "",
    to: /^\d{4}-\d{2}-\d{2}$/.test(first(sp.to)) ? first(sp.to) : "",
  };
  const hasFilter = Object.values(f).some(Boolean);

  const [actions, customers, invoices] = await Promise.all([ctx.store.list("ai_actions"), ctx.store.list("customers", { orderBy: "company_name", ascending: true }), ctx.store.list("invoices")]);
  const custBy = new Map(customers.map((c) => [c.id, c]));
  const invBy = new Map(invoices.map((i) => [i.id, i]));

  const invoiceNeedle = f.invoice.toLocaleLowerCase("tr");
  const filtered = actions.filter((a) => {
    if (f.customer && a.customer_id !== f.customer) return false;
    if (f.type && a.type !== f.type) return false;
    if (f.status && a.status !== f.status) return false;
    const day = a.created_at.slice(0, 10);
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    if (invoiceNeedle) {
      const num = a.invoice_id ? invBy.get(a.invoice_id)?.invoice_number : undefined;
      if (!num || !num.toLocaleLowerCase("tr").includes(invoiceNeedle)) return false;
    }
    return true;
  });

  const count = (s: AiActionStatus) => actions.filter((a) => a.status === s).length;

  return (
    <>
      <PageHeader title={t.aiActions.title} subtitle={t.aiActions.subtitle} actions={<RunCycleButton t={t} variant="outline" />} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t.status.COMPLETED} value={String(count("COMPLETED"))} tone="success" />
        <StatCard label={t.status.PENDING_APPROVAL} value={String(count("PENDING_APPROVAL"))} tone="warning" />
        <StatCard label={t.status.NEEDS_HUMAN} value={String(count("NEEDS_HUMAN"))} tone={count("NEEDS_HUMAN") > 0 ? "critical" : "default"} />
        <StatCard label={t.status.RESOLVED} value={String(count("RESOLVED"))} />
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-4">
          <form method="get" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7 xl:items-end">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="f-customer">{t.aiActions.filterCustomer}</Label>
              <Select id="f-customer" name="customer" defaultValue={f.customer} className="h-8 text-xs">
                <option value="">{t.common.all}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="f-invoice">{t.aiActions.filterInvoice}</Label>
              <Input id="f-invoice" name="invoice" defaultValue={f.invoice} placeholder="INV-2026-…" className="h-8 text-xs" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="f-type">{t.aiActions.filterType}</Label>
              <Select id="f-type" name="type" defaultValue={f.type} className="h-8 text-xs">
                <option value="">{t.common.all}</option>
                {AI_ACTION_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {t.actionType[x]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="f-status">{t.aiActions.filterStatus}</Label>
              <Select id="f-status" name="status" defaultValue={f.status} className="h-8 text-xs">
                <option value="">{t.common.all}</option>
                {AI_ACTION_STATUSES.map((x) => (
                  <option key={x} value={x}>
                    {t.status[x]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="f-from">{L.from}</Label>
              <Input id="f-from" type="date" name="from" defaultValue={f.from} className="h-8 text-xs" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="f-to">{L.to}</Label>
              <Input id="f-to" type="date" name="to" defaultValue={f.to} className="h-8 text-xs" />
            </div>
            <div className="col-span-2 flex items-center gap-2 md:col-span-1">
              <Button type="submit" variant="outline" size="sm">
                <Filter /> {L.apply}
              </Button>
              {hasFilter && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/ai-actions">{L.clear}</Link>
                </Button>
              )}
            </div>
          </form>
        </CardHeader>
        <CardContent className="px-0">
          {filtered.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState title={t.aiActions.noActions} action={!hasFilter ? <RunCycleButton t={t} /> : undefined} />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">{L.action}</TableHead>
                  <TableHead>{t.aiActions.filterType}</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                  <TableHead>{t.common.customer}</TableHead>
                  <TableHead>{t.common.invoice}</TableHead>
                  <TableHead>{t.aiActions.recommendedAction}</TableHead>
                  <TableHead>{t.common.date}</TableHead>
                  <TableHead className="pr-5 text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => {
                  const customer = a.customer_id ? custBy.get(a.customer_id) : undefined;
                  const invoice = a.invoice_id ? invBy.get(a.invoice_id) : undefined;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="pl-5">
                        <div className="flex items-start gap-2">
                          <SeverityIcon severity={a.severity} className="mt-0.5" />
                          <div className="min-w-0 max-w-md">
                            <p className="font-medium">{a.title}</p>
                            {a.description && <p className="line-clamp-2 text-xs text-muted-foreground">{a.description}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral">{t.actionType[a.type]}</Badge>
                      </TableCell>
                      <TableCell>
                        <ActionStatusBadge status={a.status} t={t} />
                      </TableCell>
                      <TableCell>
                        {customer ? (
                          <Link href={`/customers/${customer.id}`} className="hover:underline">
                            {customer.company_name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {invoice ? (
                          <Link href={`/invoices/${invoice.id}`} className="font-mono text-xs hover:underline">
                            {invoice.invoice_number}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs text-xs text-muted-foreground">{a.recommended_action ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(a.created_at, locale)}</TableCell>
                      <TableCell className="pr-5 text-right">
                        {a.status === "NEEDS_HUMAN" ? (
                          <div className="flex justify-end gap-1.5">
                            {a.communication_id && (
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/communications?customer=${a.customer_id ?? ""}&reply=${a.communication_id}`}>{t.aiActions.approveResponse}</Link>
                              </Button>
                            )}
                            <ResolveButton id={a.id} t={t} />
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <p className="mt-2 text-xs text-muted-foreground">
        {filtered.length} / {actions.length} {L.results}
      </p>
    </>
  );
}
