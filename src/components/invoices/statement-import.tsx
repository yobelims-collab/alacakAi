"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, FileCode2, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { importAccountStatementAction } from "@/lib/actions/invoices";
import { openByCurrency, parseAccountStatement, type ParsedStatement } from "@/lib/domain/cari-ekstre";
import { formatDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import type { Locale } from "@/lib/types";

const COPY = {
  tr: {
    title: "ERP cari ekstresi (XML)",
    subtitle: "ERP'nizdeki Cari Ekstre raporunu XML olarak dışa aktarın ve buraya bırakın. Faturalar, tahsilatlar ve devir bakiyesi okunur; tahsilatlar açıklamada geçen faturaya, yoksa en eski açık borca eşleştirilir.",
    how: "Nasıl alınır: Finans Raporları → Cari Ekstre → kriterleri seçin (tüm müşteriler için Cari Kodu boş bırakılabilir; Devir Gelsin açık) → üstteki XML düğmesi.",
    drop: "XML dosyasını buraya sürükleyin",
    or: "veya",
    choose: "Dosya seçin",
    limit: "En fazla 4 MB",
    period: "Dönem",
    invoices: "fatura",
    payments: "tahsilat eşleşmesi",
    ignored: "kur farkı/boş satır yok sayıldı",
    open: "Açık bakiye",
    overdue: "vadesi geçmiş",
    number: "Belge no",
    date: "Tarih",
    due: "Vade",
    amount: "Tutar",
    paid: "Ödenen",
    rest: "Kalan",
    opening: "Devir",
    showAll: "Tüm faturaları göster",
    showOpen: "Sadece açık faturalar",
    noOpen: "Açık fatura yok — tüm borçlar kapanmış.",
    import: "İçe aktar",
    clear: "Temizle",
    done: (r: { importedInvoices: number; updatedInvoices: number; recordedPayments: number; createdCustomers: number }) =>
      `${r.importedInvoices} fatura eklendi · ${r.updatedInvoices} güncellendi · ${r.recordedPayments} tahsilat · ${r.createdCustomers} yeni müşteri`,
    notXml: "Bu dosya bir cari ekstre XML'i değil.",
  },
  en: {
    title: "ERP account statement (XML)",
    subtitle: "Export the Cari Ekstre (account statement) report from your ERP as XML and drop it here. Invoices, receipts and the opening balance are read; each receipt is matched to the invoice named in its description, otherwise to the oldest open debt.",
    how: "Where to find it: Finance reports → Cari Ekstre → choose the criteria (leave the customer code empty for all customers; keep the opening balance on) → the XML button at the top.",
    drop: "Drag the XML file here",
    or: "or",
    choose: "Choose file",
    limit: "Up to 4 MB",
    period: "Period",
    invoices: "invoices",
    payments: "payment matches",
    ignored: "exchange-difference/empty rows ignored",
    open: "Open balance",
    overdue: "overdue",
    number: "Document",
    date: "Date",
    due: "Due",
    amount: "Amount",
    paid: "Paid",
    rest: "Open",
    opening: "Opening",
    showAll: "Show all invoices",
    showOpen: "Open invoices only",
    noOpen: "No open invoices — everything is settled.",
    import: "Import",
    clear: "Clear",
    done: (r: { importedInvoices: number; updatedInvoices: number; recordedPayments: number; createdCustomers: number }) =>
      `${r.importedInvoices} invoices added · ${r.updatedInvoices} updated · ${r.recordedPayments} payments · ${r.createdCustomers} new customers`,
    notXml: "This file is not an account statement XML.",
  },
};

const MAX_BYTES = 4 * 1024 * 1024;

export function StatementImport({ locale, initialXml = "" }: { locale: Locale; initialXml?: string }) {
  const c = COPY[locale];
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [xml, setXml] = useState(initialXml);
  const [fileName, setFileName] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [importing, startImport] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  const parsed = useMemo(() => (xml ? parseAccountStatement(xml) : null), [xml]);
  const statement: ParsedStatement | null = parsed?.ok ? parsed.statement : null;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) return toast.error(c.limit);
    setFileName(file.name);
    setXml(await file.text());
  };

  const doImport = () =>
    startImport(async () => {
      const r = await importAccountStatementAction(xml);
      if (!r.ok || !r.data) return void toast.error(r.error ?? "Error");
      toast.success(c.done(r.data));
      for (const w of r.data.warnings.slice(0, 3)) toast.warning(w);
      router.push("/invoices");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{c.title}</CardTitle>
          <CardDescription>{c.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{c.how}</p>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void onFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center ${dragging ? "border-brand bg-brand/5" : ""}`}
          >
            <FileCode2 className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">{fileName ?? c.drop}</p>
            <p className="text-xs text-muted-foreground">{c.or}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
              {c.choose}
            </Button>
            <p className="text-xs text-muted-foreground">{c.limit}</p>
            <input ref={input} type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          </div>
          {parsed && !parsed.ok && (
            <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {parsed.error}
            </p>
          )}
        </CardContent>
      </Card>

      {statement && (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{statement.customers.map((s) => s.name).join(", ")}</CardTitle>
              <CardDescription>
                {statement.period.from && statement.period.to ? `${c.period}: ${formatDate(statement.period.from, locale)} – ${formatDate(statement.period.to, locale)} · ` : ""}
                {statement.customers.map((s) => [s.code, s.email].filter(Boolean).join(" · ")).join(" | ")}
              </CardDescription>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setXml("");
                  setFileName(null);
                }}
              >
                <X /> {c.clear}
              </Button>
              <Button variant="brand" size="sm" onClick={doImport} disabled={importing}>
                {importing ? <Loader2 className="animate-spin" /> : <Upload />} {c.import}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">
                <CheckCircle2 /> {statement.invoices.length} {c.invoices}
              </Badge>
              <Badge variant="info">
                {statement.allocations.length} {c.payments}
              </Badge>
              <Badge variant="neutral">
                {statement.ignoredRows} {c.ignored}
              </Badge>
              {Object.entries(openByCurrency(statement.invoices)).filter(([, amt], _i, all) => (amt ?? 0) > 0.005 || all.every(([, a]) => (a ?? 0) <= 0.005)).map(([cur, amt]) => (
                <Badge key={cur} variant={amt && amt > 0 ? "warning" : "success"}>
                  {c.open}: {formatMoney(amt ?? 0, cur as never, locale)}
                </Badge>
              ))}
            </div>
            {statement.warnings.map((w) => (
              <p key={w} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {w}
              </p>
            ))}
            {(() => {
              const rows = [...statement.invoices]
                .filter((i) => showAll || i.amount - i.paid > 0.005)
                .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
              if (!rows.length) return <p className="text-sm text-muted-foreground">{c.noOpen}</p>;
              return (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{c.number}</TableHead>
                        <TableHead>{c.date}</TableHead>
                        <TableHead>{c.due}</TableHead>
                        <TableHead className="text-right">{c.amount}</TableHead>
                        <TableHead className="text-right">{c.paid}</TableHead>
                        <TableHead className="text-right">{c.rest}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((i) => {
                        const rest = Math.round((i.amount - i.paid) * 100) / 100;
                        const late = rest > 0 && i.dueDate < today;
                        return (
                          <TableRow key={`${i.customerCode}|${i.number}`}>
                            <TableCell className="font-mono text-xs">
                              {i.opening ? <Badge variant="neutral">{c.opening}</Badge> : i.number}
                            </TableCell>
                            <TableCell>{formatDate(i.issueDate, locale)}</TableCell>
                            <TableCell className={late ? "font-medium text-red-700 dark:text-red-300" : ""}>
                              {formatDate(i.dueDate, locale)}
                              {late && <span className="ml-1 text-[11px]">({c.overdue})</span>}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(i.amount, i.currency, locale)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(i.paid, i.currency, locale)}</TableCell>
                            <TableCell className="text-right font-medium tabular-nums">{formatMoney(rest, i.currency, locale)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              );
            })()}
            <div>
              <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                {showAll ? c.showOpen : c.showAll}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
