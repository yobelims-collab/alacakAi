"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Download, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { importBankCsvAction, validateBankCsvAction } from "@/lib/actions/payments";
import { formatDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { CsvValidation } from "@/lib/services/import-service";
import type { Locale } from "@/lib/types";
import type { BankCsvRow } from "@/lib/validation";

const LOCAL = {
  tr: {
    file: "CSV dosyası",
    orPaste: "veya CSV içeriğini yapıştırın",
    validate: "Doğrula",
    importBtn: "Doğrulanan satırları içe aktar",
    sample: "Örnek CSV indir",
    headers: "Bulunan sütunlar",
    validRows: "Geçerli satır",
    errorRows: "Hatalı satır",
    preview: "Önizleme (ilk 20 satır)",
    row: "Satır",
    description: "Açıklama",
    noConnection: "MVP'de gerçek banka bağlantısı yoktur. Hesap hareketlerini bankanızdan CSV olarak dışa aktarıp buraya yükleyin; alacak (pozitif) satırlar eşleşmemiş ödeme olarak kaydedilir ve AI fatura önerir, borç satırları yoksayılır.",
    suggested: "AI önerili",
    skipped: "yinelenen satır atlandı",
    empty: "Önce bir dosya seçin veya içerik yapıştırın.",
  },
  en: {
    file: "CSV file",
    orPaste: "or paste the CSV contents",
    validate: "Validate",
    importBtn: "Import validated rows",
    sample: "Download sample CSV",
    headers: "Detected columns",
    validRows: "Valid rows",
    errorRows: "Rows with errors",
    preview: "Preview (first 20 rows)",
    row: "Row",
    description: "Description",
    noConnection: "There is no live bank connection in the MVP. Export your statement as CSV from your bank and upload it here; credit (positive) rows become unmatched payments with an AI invoice suggestion, debit rows are ignored.",
    suggested: "AI suggested",
    skipped: "duplicate rows skipped",
    empty: "Choose a file or paste contents first.",
  },
};

export function BankImport({ sample, t, locale }: { sample: string; t: Dictionary; locale: Locale }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [result, setResult] = useState<CsvValidation<BankCsvRow> | null>(null);
  const [pending, start] = useTransition();
  const L = LOCAL[locale];
  const sampleHref = `data:text/csv;charset=utf-8,${encodeURIComponent(sample)}`;

  const onFile = (file: File | undefined) => {
    if (!file) return;
    file.text().then((content) => {
      setText(content);
      setResult(null);
    });
  };

  const validate = () => {
    if (!text.trim()) {
      toast.error(L.empty);
      return;
    }
    start(async () => {
      const r = await validateBankCsvAction(text);
      setResult(r);
    });
  };

  const doImport = () =>
    start(async () => {
      const r = await importBankCsvAction(text);
      if (!r.ok || !r.data) {
        toast.error(r.error ?? "Error");
        return;
      }
      toast.success(`${r.data.imported} ${t.payments.bankImported} · ${r.data.suggested} ${L.suggested} · ${r.data.skipped} ${L.skipped}`);
      router.push("/payments");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{t.payments.importBank}</CardTitle>
            <CardDescription>{t.payments.bankCsvHint}</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <a href={sampleHref} download="bank-sample.csv">
              <Download /> {L.sample}
            </a>
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_1fr]">
            <Field label={L.file}>
              <Input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
            </Field>
            <Field label={L.orPaste}>
              <Textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setResult(null);
                }}
                rows={6}
                placeholder={sample}
                className="font-mono text-xs"
                spellCheck={false}
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={pending} onClick={validate}>
              {pending ? <Loader2 className="animate-spin" /> : <FileUp />} {L.validate}
            </Button>
            <Button variant="brand" size="sm" disabled={pending || !result || result.valid.length === 0} onClick={doImport}>
              {pending ? <Loader2 className="animate-spin" /> : <Upload />} {L.importBtn}
            </Button>
          </div>
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{L.noConnection}</p>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600" /> {t.invoices.csvValidated}
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <span>
                {L.headers}: {result.headers.length > 0 ? result.headers.join(", ") : "—"}
              </span>
              <Badge variant="success">
                {L.validRows}: {result.valid.length}
              </Badge>
              <Badge variant={result.errors.length > 0 ? "critical" : "neutral"}>
                {L.errorRows}: {result.errors.length}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-0">
            {result.errors.length > 0 && (
              <ul className="mx-5 flex flex-col gap-1 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-800 dark:text-red-200">
                {result.errors.slice(0, 50).map((e, idx) => (
                  <li key={`${e.row}-${idx}`}>
                    <span className="font-medium tabular">
                      {L.row} {e.row}:
                    </span>{" "}
                    {e.message}
                  </li>
                ))}
              </ul>
            )}
            {result.valid.length > 0 && (
              <div>
                <p className="mb-2 px-5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{L.preview}</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">{L.row}</TableHead>
                      <TableHead>{t.common.date}</TableHead>
                      <TableHead>{L.description}</TableHead>
                      <TableHead>{t.common.reference}</TableHead>
                      <TableHead className="text-right">{t.common.amount}</TableHead>
                      <TableHead className="pr-5">{t.common.currency}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.valid.slice(0, 20).map(({ row, data }) => (
                      <TableRow key={row}>
                        <TableCell className="pl-5 tabular text-muted-foreground">{row}</TableCell>
                        <TableCell>{formatDate(data.transaction_date, locale)}</TableCell>
                        <TableCell className="max-w-64 truncate" title={data.description ?? undefined}>
                          {data.description ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-40 truncate text-muted-foreground" title={data.reference ?? undefined}>
                          {data.reference ?? "—"}
                        </TableCell>
                        <TableCell className={`text-right tabular font-medium ${data.amount < 0 ? "text-red-700 dark:text-red-300" : ""}`}>{formatMoney(data.amount, data.currency, locale)}</TableCell>
                        <TableCell className="pr-5 text-muted-foreground">{data.currency}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
