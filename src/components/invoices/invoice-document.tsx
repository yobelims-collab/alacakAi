"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { removeInvoiceDocumentAction, uploadInvoiceDocumentAction } from "@/lib/actions/invoices";
import type { Locale } from "@/lib/types";

const MAX_BYTES = 4 * 1024 * 1024;

const COPY = {
  tr: {
    title: "Fatura PDF'i",
    hint: "E-posta hatırlatmalarına ek olarak gönderilir. Yalnızca PDF, en fazla 4 MB.",
    none: "Henüz PDF yüklenmedi.",
    upload: "PDF yükle",
    replace: "Değiştir",
    download: "İndir",
    remove: "Kaldır",
    confirmRemove: "Fatura PDF'i kaldırılsın mı? Sonraki e-postalar eksiz gönderilir.",
    uploaded: "PDF yüklendi",
    removed: "PDF kaldırıldı",
    notPdf: "Lütfen bir PDF dosyası seçin.",
    tooLarge: "PDF en fazla 4 MB olabilir.",
  },
  en: {
    title: "Invoice PDF",
    hint: "Attached to e-mail reminders. PDF only, up to 4 MB.",
    none: "No PDF uploaded yet.",
    upload: "Upload PDF",
    replace: "Replace",
    download: "Download",
    remove: "Remove",
    confirmRemove: "Remove the invoice PDF? Later e-mails will be sent without it.",
    uploaded: "PDF uploaded",
    removed: "PDF removed",
    notPdf: "Please choose a PDF file.",
    tooLarge: "The PDF must be 4 MB or smaller.",
  },
};

export function InvoiceDocument({ locale, invoiceId, documentName }: { locale: Locale; invoiceId: string; documentName: string | null }) {
  const L = COPY[locale];
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  const onFile = (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      toast.error(L.notPdf);
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(L.tooLarge);
      return;
    }
    const fd = new FormData();
    fd.set("invoiceId", invoiceId);
    fd.set("file", file);
    start(async () => {
      const r = await uploadInvoiceDocumentAction(fd);
      if (!r.ok) toast.error(r.error ?? "Error");
      else toast.success(`${L.uploaded}: ${r.data?.name ?? file.name}`);
      router.refresh();
    });
  };

  const remove = () => {
    if (!window.confirm(L.confirmRemove)) return;
    start(async () => {
      const r = await removeInvoiceDocumentAction(invoiceId);
      if (!r.ok) toast.error(r.error ?? "Error");
      else toast.success(L.removed);
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{L.title}</CardTitle>
        <CardDescription>{L.hint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {documentName ? (
          <div className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate font-medium" title={documentName}>
              {documentName}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{L.none}</p>
        )}
        <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={documentName ? "outline" : "default"} size="sm" onClick={() => input.current?.click()} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Upload />} {documentName ? L.replace : L.upload}
          </Button>
          {documentName && (
            <>
              <Button asChild variant="outline" size="sm">
                <a href={`/api/invoices/${invoiceId}/document`}>
                  <Download /> {L.download}
                </a>
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={pending}>
                <Trash2 /> {L.remove}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
