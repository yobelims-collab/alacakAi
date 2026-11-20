"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Mail, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/domain/dates";
import type { Locale } from "@/lib/types";

export interface EmailImportHistoryItem {
  at: string;
  file: string;
  ok: boolean;
  error: string | null;
  imported: number;
  payments: number;
}

const COPY = {
  tr: {
    title: "Otomatik içe aktarma (e-posta)",
    subtitle: "ERP'niz Cari Ekstre raporunu her gün bu adrese e-postayla göndersin. Ekteki XML veya Excel dosyası otomatik içe aktarılır; yalnızca yeni fatura ve tahsilatlar eklenir.",
    address: "Şirketinizin içe aktarma adresi",
    copy: "Kopyala",
    copied: "Kopyalandı",
    steps: [
      "ERP'de Cari Ekstre raporunu açın: Cari Kodu boş (tüm müşteriler), Devir Gelsin açık, dönem son 12 ay.",
      "Raporu XML veya Excel eki olarak bu adrese gönderilecek şekilde zamanlayın (ör. her gün 07:00).",
      "İlk gönderimden sonra sonucu aşağıda görürsünüz.",
    ],
    secret: "Bu adresi gizli tutun: adrese gönderilen her ekstre şirketinize aktarılır.",
    history: "Son otomatik içe aktarmalar",
    empty: "Henüz e-posta ile içe aktarma yok.",
    added: (i: number, p: number) => `${i} fatura eklendi · ${p} tahsilat`,
    notReady: "Sunucuda otomatik içe aktarma henüz ayarlanmadı. Eksik ortam değişkenleri:",
    noAccess: "İçe aktarma adresini yalnızca düzenleme yetkisi olan kullanıcılar görebilir.",
    demo: "Demo modunda içe aktarılan veriler herkese açık demo hesabına gider ve yeniden başlatmada silinir. Gerçek ekstreyi bu adrese göndermeyin.",
  },
  en: {
    title: "Automatic import (email)",
    subtitle: "Let your ERP email the Cari Ekstre report to this address every day. The attached XML or Excel file is imported automatically; only new invoices and payments are added.",
    address: "Your company’s import address",
    copy: "Copy",
    copied: "Copied",
    steps: [
      "In the ERP, open the Cari Ekstre report: customer code empty (all customers), opening balance on, period the last 12 months.",
      "Schedule it to be emailed to this address as an XML or Excel attachment (for example daily at 07:00).",
      "After the first delivery, the result appears below.",
    ],
    secret: "Keep this address private: any statement sent to it is imported into your company.",
    history: "Recent automatic imports",
    empty: "No imports by email yet.",
    added: (i: number, p: number) => `${i} invoices added · ${p} payments`,
    notReady: "Automatic import is not set up on the server yet. Missing environment variables:",
    noAccess: "Only users who can edit see the import address.",
    demo: "In demo mode imported data goes into the public demo account and is lost on restart. Do not send real statements to this address.",
  },
};

export function EmailImportCard({ locale, address, missing, canSee, demo, history }: { locale: Locale; address: string | null; missing: string[]; canSee: boolean; demo: boolean; history: EmailImportHistoryItem[] }) {
  const c = COPY[locale];
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the address is still selectable */
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4 text-brand" aria-hidden /> {c.title}
        </CardTitle>
        <CardDescription>{c.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!canSee ? (
          <p className="text-sm text-muted-foreground">{c.noAccess}</p>
        ) : address && missing.length === 0 ? (
          <>
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">{c.address}</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 select-all break-all rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs">{address}</code>
                <Button type="button" variant="outline" size="sm" onClick={copy}>
                  {copied ? <CheckCircle2 /> : <Copy />} {copied ? c.copied : c.copy}
                </Button>
              </div>
            </div>
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted-foreground">
              {c.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {c.secret}
            </p>
            {demo && <p className="text-xs text-muted-foreground">{c.demo}</p>}
          </>
        ) : (
          <p className="flex items-start gap-2 rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {c.notReady} <code className="font-mono">{missing.join(", ")}</code>
            </span>
          </p>
        )}

        {canSee && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">{c.history}</p>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">{c.empty}</p>
            ) : (
              <ul className="flex flex-col divide-y rounded-lg border">
                {history.map((h, i) => (
                  <li key={`${h.at}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                    {h.ok ? <CheckCircle2 className="size-4 text-emerald-600" aria-label="OK" /> : <XCircle className="size-4 text-red-600" aria-label="Error" />}
                    <span className="text-muted-foreground tabular-nums">{formatDateTime(h.at, locale)}</span>
                    <span className="font-mono text-xs">{h.file}</span>
                    <span className={h.ok ? "" : "text-red-700 dark:text-red-300"}>{h.ok ? c.added(h.imported, h.payments) : h.error}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
