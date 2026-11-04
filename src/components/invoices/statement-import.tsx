"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, ShieldAlert, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { importAccountStatementAction, type StatementImportActionResult } from "@/lib/actions/invoices";
import { parseStatementFile } from "@/lib/domain/cari-ekstre-excel";
import { openByCurrency, type ParsedStatement, type StatementResult } from "@/lib/domain/cari-ekstre";
import { formatDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import type { Locale } from "@/lib/types";

const COPY = {
  tr: {
    title: "ERP cari ekstresi (XML veya Excel)",
    subtitle: "ERP'nizdeki Cari Ekstre raporunu XML olarak dışa aktarın ve buraya bırakın. Faturalar, tahsilatlar ve devir bakiyesi okunur; tahsilatlar açıklamada geçen faturaya, yoksa en eski açık borca eşleştirilir.",
    how: "Nasıl alınır: Finans Raporları → Cari Ekstre → kriterleri seçin (tüm müşteriler için Cari Kodu boş bırakılabilir; Devir Gelsin açık) → üstteki XML veya Excel düğmesi.",
    drop: "XML veya Excel dosyasını buraya sürükleyin",
    reading: "Dosya okunuyor…",
    failed: "İçe aktarma başarısız",
    network: "Sunucuya ulaşılamadı. Sayfayı yenileyip tekrar deneyin.",
    imported: "İçe aktarıldı",
    goInvoices: "Faturalara git",
    goCustomer: "Müşterilere git",
    demoWarn: "Demo modundasınız: demo hesabı herkese açıktır ve veriler sunucu belleğinde geçici tutulur (yeniden başlatmada silinir). Gerçek müşteri verisi yüklemeyin — önce Supabase bağlantısını tamamlayın.",
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
  },
  en: {
    title: "ERP account statement (XML or Excel)",
    subtitle: "Export the Cari Ekstre (account statement) report from your ERP as XML and drop it here. Invoices, receipts and the opening balance are read; each receipt is matched to the invoice named in its description, otherwise to the oldest open debt.",
    how: "Where to find it: Finance reports → Cari Ekstre → choose the criteria (leave the customer code empty for all customers; keep the opening balance on) → the XML or Excel button at the top.",
    drop: "Drag the XML or Excel file here",
    reading: "Reading file…",
    failed: "Import failed",
    network: "Could not reach the server. Reload the page and try again.",
    imported: "Imported",
    goInvoices: "Go to invoices",
    goCustomer: "Go to customers",
    demoWarn: "You are in demo mode: the demo account is public and data is kept temporarily in server memory (lost on restart). Do not upload real customer data — finish the Supabase setup first.",
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
  },
};

const MAX_BYTES = 4 * 1024 * 1024;

export function StatementImport({ locale, demo = false }: { locale: Locale; demo?: boolean }) {
  const c = COPY[locale];
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<StatementResult | null>(null);
  const [reading, setReading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [outcome, setOutcome] = useState<StatementImportActionResult | null>(null);
  const [importing, startImport] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const statement: ParsedStatement | null = parsed?.ok ? parsed.statement : null;
  const fileName = file?.name ?? null;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_BYTES) return void toast.error(c.limit);
    setFile(f);
    setOutcome(null);
    setParsed(null);
    setReading(true);
    try {
      setParsed(await parseStatementFile(f.name, new Uint8Array(await f.arrayBuffer())));
    } catch (e) {
      setParsed({ ok: false, error: e instanceof Error ? e.message : "read failed" });
    } finally {
      setReading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setParsed(null);
    setOutcome(null);
    if (input.current) input.current.value = "";
  };

  const doImport = () =>
    startImport(async () => {
      if (!file) return;
      const fd = new FormData();
      fd.set("file", file);
      let r: StatementImportActionResult;
      try {
        r = await importAccountStatementAction(fd);
      } catch {
        r = { ok: false, error: c.network };
      }
      setOutcome(r);
      if (!r.ok || !r.data) return void toast.error(`${c.failed}: ${r.error ?? ""}`);
      toast.success(c.done(r.data));
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
          {demo && (
            <p className="flex items-start gap-2 rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {c.demoWarn}
            </p>
          )}
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
            <FileSpreadsheet className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">{reading ? c.reading : (fileName ?? c.drop)}</p>
            <p className="text-xs text-muted-foreground">{c.or}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
              {c.choose}
            </Button>
            <p className="text-xs text-muted-foreground">{c.limit}</p>
            <input ref={input} type="file" accept=".xml,.xlsx,.xls,.ods,text/xml,application/xml,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
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
                onClick={reset}
              >
                <X /> {c.clear}
              </Button>
              <Button variant="brand" size="sm" onClick={doImport} disabled={importing || Boolean(outcome?.ok)}>
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
            {outcome && (
              <div className={`flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm ${outcome.ok ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100" : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"}`}>
                <p className="flex items-start gap-2 font-medium">
                  {outcome.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />}
                  {outcome.ok && outcome.data ? `${c.imported}: ${c.done(outcome.data)}` : `${c.failed}: ${outcome.error ?? ""}`}
                </p>
                {outcome.data?.warnings.map((w) => <p key={w} className="text-xs">{w}</p>)}
                {outcome.ok && (
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline"><Link href="/invoices">{c.goInvoices}</Link></Button>
                    <Button asChild size="sm" variant="ghost"><Link href="/customers">{c.goCustomer}</Link></Button>
                  </div>
                )}
              </div>
            )}
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
