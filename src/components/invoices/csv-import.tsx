"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Download, FileUp, Loader2, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { importInvoicesAction, validateInvoiceCsvAction } from "@/lib/actions/invoices";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/types";

type Validation = Awaited<ReturnType<typeof validateInvoiceCsvAction>>;

const LABELS = {
  tr: { file: "CSV dosyası", paste: "veya CSV metnini yapıştırın", validate: "Doğrula", headers: "Bulunan sütunlar", validRows: "geçerli satır", row: "Satır", preview: "Önizleme (ilk 20 geçerli satır)", noValid: "İçe aktarılacak geçerli satır yok.", skipped: "atlandı", empty: "Önce bir dosya seçin veya CSV metni yapıştırın.", xml: "Bu bir XML dosyası. ERP cari ekstresi için \"ERP cari ekstre\" sekmesini, e-Fatura için \"e-Fatura XML\" sekmesini kullanın." },
  en: { file: "CSV file", paste: "or paste CSV text", validate: "Validate", headers: "Headers found", validRows: "valid rows", row: "Row", preview: "Preview (first 20 valid rows)", noValid: "No valid rows to import.", skipped: "skipped", empty: "Choose a file or paste CSV text first.", xml: "This is an XML file. Use the \"ERP statement\" tab for an ERP account statement, or \"e-Fatura XML\" for e-invoices." },
};

export function CsvImport({ t, locale, sample }: { t: Dictionary; locale: Locale; sample: string }) {
  const L = LABELS[locale];
  const router = useRouter();
  const [text, setText] = useState("");
  const [result, setResult] = useState<Validation | null>(null);
  const [validating, startValidate] = useTransition();
  const [importing, startImport] = useTransition();

  const downloadSample = () => {
    const url = URL.createObjectURL(new Blob([sample], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "alacakai-invoices-sample.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setText(await file.text());
    setResult(null);
  };

  const validate = () => {
    if (!text.trim()) {
      toast.error(L.empty);
      return;
    }
    if (text.trimStart().startsWith("<")) {
      toast.error(L.xml, { duration: 8000 });
      return;
    }
    startValidate(async () => {
      try {
        setResult(await validateInvoiceCsvAction(text));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const doImport = () =>
    startImport(async () => {
      const r = await importInvoicesAction(text);
      if (!r.ok) {
        toast.error(r.error ?? "Error");
        return;
      }
      toast.success(`${r.imported ?? 0} ${t.invoices.imported} · ${r.skippedDuplicates ?? 0} ${L.skipped} · ${r.createdCustomers ?? 0} ${t.invoices.createdCustomers}`);
      router.push("/invoices");
      router.refresh();
    });

  const dupSet = new Set((result?.duplicates ?? []).map((d) => d.toLocaleLowerCase("tr")));
  const importable = result ? result.valid.length - result.duplicates.length : 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>{t.invoices.importCsv}</CardTitle>
            <CardDescription>{t.invoices.csvHint}</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={downloadSample}>
            <Download /> {t.invoices.csvTemplate}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label={L.file}>
            <Input type="file" accept=".csv,text/csv" onChange={(e) => void onFile(e.target.files?.[0])} />
          </Field>
          <Field label={L.paste}>
            <Textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setResult(null);
              }}
              rows={8}
              spellCheck={false}
              className="font-mono text-xs"
              placeholder={sample.split("\n")[0]}
            />
          </Field>
          <div className="flex justify-end">
            <Button variant="default" size="sm" onClick={validate} disabled={validating || !text.trim()}>
              {validating ? <Loader2 className="animate-spin" /> : <FileUp />} {L.validate}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{t.invoices.csvValidated}</CardTitle>
              <CardDescription>
                {L.headers}: {result.headers.length ? result.headers.map((h) => <code key={h} className="mr-1 rounded bg-muted px-1 font-mono text-[11px]">{h}</code>) : "—"}
              </CardDescription>
            </div>
            <Button variant="brand" size="sm" onClick={doImport} disabled={importing || importable <= 0}>
              {importing ? <Loader2 className="animate-spin" /> : <Upload />} {t.invoices.csvImportButton} ({importable})
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">
                <CheckCircle2 /> {result.valid.length} {L.validRows}
              </Badge>
              <Badge variant={result.errors.length ? "critical" : "neutral"}>
                <XCircle /> {result.errors.length} {t.invoices.csvErrors.toLowerCase()}
              </Badge>
              <Badge variant="info">
                {result.newCustomers.length} {t.invoices.csvNewCustomers}
              </Badge>
              <Badge variant="warning">
                {result.duplicates.length} {t.invoices.csvDuplicates.toLowerCase()}
              </Badge>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3">
                <p className="text-xs font-medium text-red-800 dark:text-red-200">{t.invoices.csvErrors}</p>
                <ul className="mt-1 max-h-48 space-y-0.5 overflow-auto text-xs text-red-800 dark:text-red-200">
                  {result.errors.map((e, i) => (
                    <li key={`${e.row}-${i}`}>
                      <span className="font-mono">{L.row} {e.row}:</span> {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.newCustomers.length > 0 && (
              <div className="rounded-md border p-3">
                <p className="text-xs font-medium">{t.invoices.csvNewCustomers}</p>
                <p className="mt-1 text-xs text-muted-foreground">{result.newCustomers.join(", ")}</p>
              </div>
            )}

            {result.duplicates.length > 0 && (
              <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200">{t.invoices.csvDuplicates}</p>
                <p className="mt-1 font-mono text-xs text-amber-800 dark:text-amber-200">{result.duplicates.join(", ")}</p>
              </div>
            )}

            {result.valid.length === 0 ? (
              <p className="text-sm text-muted-foreground">{L.noValid}</p>
            ) : (
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{L.preview}</p>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{L.row}</TableHead>
                        <TableHead>{t.invoices.number}</TableHead>
                        <TableHead>{t.common.customer}</TableHead>
                        <TableHead>{t.invoices.invoiceDate}</TableHead>
                        <TableHead>{t.invoices.dueDate}</TableHead>
                        <TableHead>{t.common.currency}</TableHead>
                        <TableHead className="text-right">{t.common.amount}</TableHead>
                        <TableHead className="text-right">{t.invoices.paid}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.valid.slice(0, 20).map(({ row, data }) => {
                        const dup = dupSet.has(data.invoice_number.toLocaleLowerCase("tr"));
                        return (
                          <TableRow key={row} className={dup ? "text-muted-foreground line-through" : ""}>
                            <TableCell className="tabular">{row}</TableCell>
                            <TableCell className="font-mono text-xs">{data.invoice_number}</TableCell>
                            <TableCell>{data.customer}</TableCell>
                            <TableCell>{data.invoice_date}</TableCell>
                            <TableCell>{data.due_date}</TableCell>
                            <TableCell>{data.currency}</TableCell>
                            <TableCell className="text-right tabular">{data.amount.toLocaleString(locale === "tr" ? "tr-TR" : "en-US")}</TableCell>
                            <TableCell className="text-right tabular">{data.paid_amount.toLocaleString(locale === "tr" ? "tr-TR" : "en-US")}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
