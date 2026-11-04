/** Synthetic ekstre with the same shape as a real ERP export (no real customer data). */
const head = (o: Record<string, string>) =>
  `<CARI_EKSTRE><FIRMA_KOD>01</FIRMA_KOD><FIRMA_AD>Satıcı A.Ş.</FIRMA_AD><CARI_KOD>120 01 0001</CARI_KOD><CARI_AD>ÖRNEK TELEKOM SRL</CARI_AD><VERGI_NO>1111111111</VERGI_NO><CARI_TEL_1>+40 371 000 000</CARI_TEL_1><CARI_E_MAIL>Finance@ornek.example</CARI_E_MAIL>${Object.entries(o)
    .map(([k, v]) => (v === "" ? `<${k}/>` : `<${k}>${v}</${k}>`))
    .join("")}</CARI_EKSTRE>`;
const NULL_DATE = "0001-01-01T00:00:00+03:00";
export const statementRow = (tip: string, date: string, no: string, kaynak: string, borc: string, alacak: string, opts: Record<string, string> = {}) =>
  head({ TIP: tip, BELGE_TARIH: `${date}T00:00:00+03:00`, BELGE_NO: no, KAYNAK: kaynak, D_ACIKLAMA_1: "", BORC_VADE: opts.vade ?? NULL_DATE, ORTALAMA_VADE: opts.ort ?? NULL_DATE, KUR_KOD: opts.cur ?? "EUR", BELGE_KUR_KOD: opts.cur ?? "EUR", BORC_TUTAR: borc, ALACAK_TUTAR: alacak, BORC_TUTAR_YP: "999999.99", ...(opts.text ? { M_ACIKLAMA_1: opts.text } : {}) });

export const STATEMENT_XML = `<NewDataSet>
<xs:schema xmlns="" xmlns:xs="http://www.w3.org/2001/XMLSchema" id="NewDataSet"><xs:element name="NewDataSet"/></xs:schema>
<RAPOR_PARAM><RAPOR_BAS_TARIH>2025-11-04T00:00:00+03:00</RAPOR_BAS_TARIH><RAPOR_BIT_TARIH>2026-11-04T00:00:00+03:00</RAPOR_BIT_TARIH></RAPOR_PARAM>
${statementRow("BASLANGIC_DEVIR", "2025-11-03", "DEVIR", "KAYNAK_BULUNAMADI", "1000.00", "800.00", { ort: "2025-07-24T00:00:00+03:00" })}
${statementRow("BASLANGIC_DEVIR", "2025-11-03", "DEVIR", "KAYNAK_BULUNAMADI", "0.00", "0", { cur: "USD" })}
${statementRow("DETAY", "2025-11-05", "BNK-1", "Finans", "0", "150.00", { text: "Ref: 20251104EBG00938 Lehtar: SATICI" })}
${statementRow("DETAY", "2025-11-22", "CIH2025000000593", "Fatura", "500.00", "0", { vade: "2026-01-21T00:00:00+03:00", text: "CIH2025000000593 NO'LU FATURA" })}
${statementRow("DETAY", "2025-11-24", "CIH2025000000593", "MuhasebeKurDeðerleme", "0", "0.00", { text: "fatura ihraç tarihi farkı" })}
${statementRow("DETAY", "2025-11-28", "CIH2025000000607", "Fatura", "300.00", "0", { vade: "2026-01-27T00:00:00+03:00" })}
${statementRow("DETAY", "2025-11-29", "CIH2025000000611", "Fatura", "200.00", "0", { vade: "2026-01-28T00:00:00+03:00" })}
${statementRow("DETAY", "2025-12-22", "BNK-2", "Finans", "0", "50.00")}
${statementRow("DETAY", "2026-01-21", "BNK-3", "Finans", "0", "500.00", { text: "CIH2025000000593" })}
${statementRow("DETAY", "2026-01-22", "GM 108781", "Fatura", "0", "0.00", { text: "ITH-26028 alış" })}
${statementRow("DETAY", "2026-01-28", "BNK-4", "Finans", "0", "300.00", { text: "CIH2025000000607" })}
${statementRow("DETAY", "2026-01-28", "BNK-4", "Finans", "0", "200.00", { text: "-cih2025000000611" })}
${statementRow("DETAY", "2025-12-31", "CRH-03335", "FinansKurDeðerleme", "0.00", "0", { text: "KUR DEĞERLEME" })}
${statementRow("DETAY", "2026-09-03", "CIH2026000000410", "Fatura", "100.00", "0", { vade: "2026-11-02T00:00:00+03:00" })}
${statementRow("DETAY", "2026-09-25", "CIH2026000000453", "Fatura", "70.00", "0", { vade: "2026-11-24T00:00:00+03:00" })}
${statementRow("DETAY", "2026-09-26", "CIH2026000000460", "Fatura", "80.00", "0", { vade: "2026-11-25T00:00:00+03:00" })}
${statementRow("DETAY", "2026-10-01", "BNK-5", "Finans", "0", "150.00", { text: "CIH2026000000453 CIH2026000000460" })}
${statementRow("DETAY", "2026-08-21", "CIH2026000000387", "Fatura", "400.00", "0", { cur: "USD", vade: "2026-10-20T00:00:00+03:00" })}
${statementRow("DETAY", "2026-10-22", "BNK-6", "Finans", "0", "400.00", { cur: "USD", text: "CIH2026000000387" })}
<ReportInfo><ReportUrl>http://10.0.0.1:90</ReportUrl></ReportInfo>
</NewDataSet>`;
