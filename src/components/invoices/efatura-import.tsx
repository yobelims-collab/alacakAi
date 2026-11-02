"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { CheckCircle2, FileCode2, Loader2, MinusCircle, Upload, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { importEFaturaAction, type EFaturaFileResult } from "@/lib/actions/invoices";
import { formatDate } from "@/lib/domain/dates";
import { parseEFatura, type EFaturaParseResult } from "@/lib/domain/efatura";
import { formatMoney } from "@/lib/domain/money";
import type { Locale } from "@/lib/types";

const MAX_FILES = 200;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
/** Each server-action call stays well under the request body limit. */
const MAX_BATCH_BYTES = 3 * 1024 * 1024;

const COPY = {
  tr: {
    title: "e-Fatura / e-Arşiv XML içe aktar",
    hint: "GİB portalından veya entegratörünüzden indirdiğiniz UBL-TR XML dosyalarını seçin. Dosyalar önce tarayıcınızda okunur; içe aktarmadan önce önizlersiniz. İade faturaları alınmaz.",
    drop: "XML dosyalarını buraya sürükleyin",
    or: "veya",
    choose: "Dosya seç",
    limits: `En fazla ${MAX_FILES} dosya, dosya başına 2 MB.`,
    file: "Dosya",
    number: "Fatura no",
    buyer: "Alıcı",
    date: "Tarih",
    due: "Vade",
    amount: "Tutar",
    status: "Durum",
    termsDefault: "Vade koşulu",
    ready: "Hazır",
    duplicate: "Seçimde tekrar",
    tooLarge: "2 MB sınırını aşıyor",
    clear: "Temizle",
    import: "İçe aktar",
    readyCount: "aktarılabilir",
    errorCount: "hatalı",
    imported: "Aktarıldı",
    skipped: "Atlandı",
    failed: "Hata",
    summary: (i: number, s: number, f: number, c: number) => `${i} fatura aktarıldı · ${s} atlandı · ${f} hatalı · ${c} yeni müşteri`,
    tooMany: `En fazla ${MAX_FILES} dosya seçebilirsiniz; fazlası yok sayıldı.`,
    notXml: "Yalnızca .xml dosyaları okunur.",
  },
  en: {
    title: "Import e-Fatura / e-Arşiv XML",
    hint: "Choose UBL-TR XML files downloaded from the GİB portal or your integrator. Files are read in your browser first so you can preview them before importing. Return invoices (İADE) are not imported.",
    drop: "Drag XML files here",
    or: "or",
    choose: "Choose files",
    limits: `Up to ${MAX_FILES} files, 2 MB each.`,
    file: "File",
    number: "Invoice no",
    buyer: "Buyer",
    date: "Date",
    due: "Due",
    amount: "Amount",
    status: "Status",
    termsDefault: "Payment terms",
    ready: "Ready",
    duplicate: "Duplicate in selection",
    tooLarge: "Exceeds 2 MB",
    clear: "Clear",
    import: "Import",
    readyCount: "importable",
    errorCount: "with errors",
    imported: "Imported",
    skipped: "Skipped",
    failed: "Error",
    summary: (i: number, s: number, f: number, c: number) => `${i} invoices imported · ${s} skipped · ${f} failed · ${c} new customers`,
    tooMany: `You can choose up to ${MAX_FILES} files; the rest were ignored.`,
    notXml: "Only .xml files are read.",
  },
};

interface Item {
  key: string;
  name: string;
  xml: string;
  size: number;
  parsed: EFaturaParseResult;
  localError: string | null;
}

function dedupeKey(p: EFaturaParseResult): string | null {
  return p.ok ? (p.invoice.ettn ?? p.invoice.invoiceNumber.toLocaleLowerCase("tr")) : null;
}

export function EFaturaImport({ locale }: { locale: Locale }) {
  const L = COPY[locale];
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [results, setResults] = useState<Record<string, EFaturaFileResult>>({});
  const [dragging, setDragging] = useState(false);
  const [importing, start] = useTransition();

  const addFiles = async (list: FileList | File[] | null) => {
    if (!list) return;
    const all = Array.from(list);
    const files = all.filter((f) => /\.xml$/i.test(f.name) || f.type.includes("xml"));
    if (files.length < all.length) toast.error(L.notXml);
    const room = MAX_FILES - items.length;
    if (files.length > room) toast.error(L.tooMany);
    const read = await Promise.all(
      files.slice(0, Math.max(0, room)).map(async (f, i): Promise<Item> => {
        const key = `${f.name}-${f.size}-${f.lastModified}-${Date.now()}-${i}`;
        if (f.size > MAX_FILE_BYTES) return { key, name: f.name, xml: "", size: f.size, parsed: { ok: false, error: L.tooLarge }, localError: L.tooLarge };
        const xml = await f.text();
        return { key, name: f.name, xml, size: f.size, parsed: parseEFatura(xml), localError: null };
      }),
    );
    setItems((prev) => {
      const seen = new Set(prev.map((x) => dedupeKey(x.parsed)).filter(Boolean));
      const next = [...prev];
      for (const it of read) {
        const k = dedupeKey(it.parsed);
        if (k && seen.has(k)) it.localError = L.duplicate;
        if (k) seen.add(k);
        next.push(it);
      }
      return next;
    });
    setResults({});
    if (input.current) input.current.value = "";
  };

  const sendable = items.filter((x) => x.parsed.ok && !x.localError);
  const errorCount = items.length - sendable.length;

  const doImport = () =>
    start(async () => {
      const batches: Item[][] = [];
      let cur: Item[] = [];
      let bytes = 0;
      for (const it of sendable) {
        if (cur.length && bytes + it.size > MAX_BATCH_BYTES) {
          batches.push(cur);
          cur = [];
          bytes = 0;
        }
        cur.push(it);
        bytes += it.size;
      }
      if (cur.length) batches.push(cur);

      const next: Record<string, EFaturaFileResult> = {};
      let imported = 0;
      let skipped = 0;
      let failed = 0;
      let created = 0;
      for (const batch of batches) {
        const r = await importEFaturaAction(batch.map((b) => ({ name: b.name, xml: b.xml })));
        if (!r.ok) {
          for (const b of batch) next[b.key] = { name: b.name, status: "error", message: r.error ?? "Error", invoiceNumber: null };
          failed += batch.length;
          continue;
        }
        batch.forEach((b, i) => {
          if (r.results[i]) next[b.key] = r.results[i];
        });
        imported += r.imported;
        skipped += r.skipped;
        failed += r.failed;
        created += r.createdCustomers;
      }
      setResults(next);
      const msg = L.summary(imported, skipped, failed, created);
      if (imported > 0) toast.success(msg);
      else toast.error(msg);
      router.refresh();
    });

  const statusCell = (it: Item) => {
    const res = results[it.key];
    if (res) {
      if (res.status === "ok") return <Badge variant="success"><CheckCircle2 /> {L.imported}</Badge>;
      if (res.status === "skipped") return <span className="flex flex-col gap-0.5"><Badge variant="warning" className="w-fit"><MinusCircle /> {L.skipped}</Badge>{res.message && <span className="text-xs text-muted-foreground">{res.message}</span>}</span>;
      return <span className="flex flex-col gap-0.5"><Badge variant="critical" className="w-fit"><XCircle /> {L.failed}</Badge>{res.message && <span className="text-xs text-red-700 dark:text-red-300">{res.message}</span>}</span>;
    }
    if (!it.parsed.ok) return <span className="text-xs text-red-700 dark:text-red-300">{it.parsed.error}</span>;
    if (it.localError) return <Badge variant="warning">{it.localError}</Badge>;
    return <Badge variant="info">{L.ready}</Badge>;
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{L.title}</CardTitle>
          <CardDescription>{L.hint}</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void addFiles(e.dataTransfer.files);
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors ${dragging ? "border-primary bg-muted" : "bg-muted/30"}`}
          >
            <FileCode2 className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">{L.drop}</p>
            <p className="text-xs text-muted-foreground">{L.or}</p>
            <input ref={input} type="file" accept=".xml,application/xml,text/xml" multiple className="hidden" onChange={(e) => void addFiles(e.target.files)} />
            <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={importing}>
              {L.choose}
            </Button>
            <p className="text-xs text-muted-foreground">{L.limits}</p>
          </div>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">
                <CheckCircle2 /> {sendable.length} {L.readyCount}
              </Badge>
              <Badge variant={errorCount ? "critical" : "neutral"}>
                <XCircle /> {errorCount} {L.errorCount}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setItems([]);
                  setResults({});
                }}
                disabled={importing}
              >
                <X /> {L.clear}
              </Button>
              <Button variant="brand" size="sm" onClick={doImport} disabled={importing || sendable.length === 0 || Object.keys(results).length > 0}>
                {importing ? <Loader2 className="animate-spin" /> : <Upload />} {L.import} ({sendable.length})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{L.file}</TableHead>
                    <TableHead>{L.number}</TableHead>
                    <TableHead>{L.buyer}</TableHead>
                    <TableHead>{L.date}</TableHead>
                    <TableHead>{L.due}</TableHead>
                    <TableHead className="text-right">{L.amount}</TableHead>
                    <TableHead>{L.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => {
                    const inv = it.parsed.ok ? it.parsed.invoice : null;
                    return (
                      <TableRow key={it.key}>
                        <TableCell className="max-w-40 truncate text-xs text-muted-foreground" title={it.name}>
                          {it.name}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{inv?.invoiceNumber ?? "—"}</TableCell>
                        <TableCell className="max-w-56 truncate" title={inv?.buyerName}>
                          {inv?.buyerName ?? "—"}
                          {inv?.buyerTaxId && <span className="block text-xs text-muted-foreground tabular">{inv.buyerTaxScheme} {inv.buyerTaxId}</span>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{inv ? formatDate(inv.issueDate, locale) : "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{inv ? (inv.dueDate ? formatDate(inv.dueDate, locale) : <span className="text-xs text-muted-foreground">{L.termsDefault}</span>) : "—"}</TableCell>
                        <TableCell className="text-right tabular whitespace-nowrap">{inv ? formatMoney(inv.amount, inv.currency, locale) : "—"}</TableCell>
                        <TableCell>{statusCell(it)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
