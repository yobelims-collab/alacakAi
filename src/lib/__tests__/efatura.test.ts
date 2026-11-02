import { describe, expect, it } from "vitest";
import { parseEFatura } from "@/lib/domain/efatura";

const NS = `xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"`;

/** TICARIFATURA, EUR, buyer is a company with VKN, due date in PaymentMeans. */
const TICARI = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="general.xslt"?>
<Invoice ${NS}>
  <ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>TR1.2</cbc:CustomizationID>
  <cbc:ProfileID>TICARIFATURA</cbc:ProfileID>
  <cbc:ID>DMO2026000000123</cbc:ID>
  <cbc:CopyIndicator>false</cbc:CopyIndicator>
  <cbc:UUID>F47AC10B-58CC-4372-A567-0E02B2C3D479</cbc:UUID>
  <cbc:IssueDate>2026-08-20</cbc:IssueDate>
  <cbc:IssueTime>14:32:10</cbc:IssueTime>
  <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>
  <cbc:Note>Sipariş no: PO-7781</cbc:Note>
  <cbc:Note>Yalnız on sekiz bin beş yüz Euro</cbc:Note>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:LineCountNumeric>1</cbc:LineCountNumeric>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="VKN">1234567890</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>Demo Teknoloji A.Ş.</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="MERSISNO">0123456789000015</cbc:ID></cac:PartyIdentification>
      <cac:PartyIdentification><cbc:ID schemeID="VKN">9876543210</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>ABC Teknoloji A.Ş.</cbc:Name></cac:PartyName>
      <cac:PostalAddress><cbc:CityName>İstanbul</cbc:CityName><cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country></cac:PostalAddress>
      <cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>Maslak</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>
      <cac:Contact>
        <cbc:Telephone>+90 212 555 0101</cbc:Telephone>
        <cbc:ElectronicMail>muhasebe@abcteknoloji.com</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>42</cbc:PaymentMeansCode>
    <cbc:PaymentDueDate>2026-09-19</cbc:PaymentDueDate>
    <cac:PayeeFinancialAccount><cbc:ID>TR330006100519786457841326</cbc:ID></cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">3083.33</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">15416.67</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">15416.67</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">18500.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">18500.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;

/** e-Arşiv, currency written as "TL", buyer is a person (TCKN), no due date at all, no contact. */
const EARSIV = `<Invoice ${NS}>
  <cbc:ProfileID>EARSIVFATURA</cbc:ProfileID>
  <cbc:ID>EAR2026000004567</cbc:ID>
  <cbc:UUID>3b241101-e2bb-4255-8caf-4136c566a962</cbc:UUID>
  <cbc:IssueDate>2026-10-05</cbc:IssueDate>
  <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>TL</cbc:DocumentCurrencyCode>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="TCKN">11111111110</cbc:ID></cac:PartyIdentification>
      <cac:Person><cbc:FirstName>Ayşe</cbc:FirstName><cbc:FamilyName>Yılmaz</cbc:FamilyName></cac:Person>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:PayableAmount currencyID="TRY">4250.5</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;

const withType = (code: string) => EARSIV.replace("<cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>", `<cbc:InvoiceTypeCode>${code}</cbc:InvoiceTypeCode>`);

describe("parseEFatura", () => {
  it("parses a TICARIFATURA with namespaces, attributes and a PaymentMeans due date", () => {
    const r = parseEFatura(TICARI);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.invoice).toEqual({
      invoiceNumber: "DMO2026000000123",
      ettn: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      issueDate: "2026-08-20",
      dueDate: "2026-09-19",
      currency: "EUR",
      amount: 18500,
      buyerName: "ABC Teknoloji A.Ş.",
      buyerTaxId: "9876543210",
      buyerTaxScheme: "VKN",
      buyerEmail: "muhasebe@abcteknoloji.com",
      buyerPhone: "+90 212 555 0101",
      invoiceType: "SATIS",
      profileId: "TICARIFATURA",
      note: "Sipariş no: PO-7781",
    });
  });

  it("parses an e-Arşiv invoice for a person with TL currency and no due date", () => {
    const r = parseEFatura(EARSIV);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.invoice.currency).toBe("TRY");
    expect(r.invoice.amount).toBe(4250.5);
    expect(r.invoice.dueDate).toBeNull();
    expect(r.invoice.buyerName).toBe("Ayşe Yılmaz");
    expect(r.invoice.buyerTaxScheme).toBe("TCKN");
    expect(r.invoice.buyerTaxId).toBe("11111111110");
    expect(r.invoice.buyerEmail).toBeNull();
    expect(r.invoice.note).toBeNull();
  });

  it("falls back to PaymentTerms/PaymentDueDate when PaymentMeans has none", () => {
    const xml = EARSIV.replace("<cac:LegalMonetaryTotal>", "<cac:PaymentMeans><cbc:PaymentMeansCode>1</cbc:PaymentMeansCode></cac:PaymentMeans><cac:PaymentTerms><cbc:Note>30 gün</cbc:Note><cbc:PaymentDueDate>2026-11-04</cbc:PaymentDueDate></cac:PaymentTerms><cac:LegalMonetaryTotal>");
    const r = parseEFatura(xml);
    expect(r.ok && r.invoice.dueDate).toBe("2026-11-04");
  });

  it("rejects return invoices (IADE) with a clear error", () => {
    const r = parseEFatura(withType("IADE"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/İade|return/);
    expect(parseEFatura(withType("TEVKIFATIADE")).ok).toBe(false);
    expect(parseEFatura(withType("TEVKIFAT")).ok).toBe(true);
  });

  it("rejects unsupported currencies", () => {
    const r = parseEFatura(EARSIV.replace(">TL<", ">CHF<"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("CHF");
  });

  it("rejects non-invoices, malformed XML, DOCTYPE/entities and missing amounts", () => {
    expect(parseEFatura("").ok).toBe(false);
    expect(parseEFatura("<Invoice><cbc:ID>x</Invoice>").ok).toBe(false);
    expect(parseEFatura(`<Order ${NS}><cbc:ID>1</cbc:ID></Order>`).ok).toBe(false);
    const xxe = `<?xml version="1.0"?><!DOCTYPE Invoice [<!ENTITY x SYSTEM "file:///etc/passwd">]>${EARSIV.replace("Ayşe", "&x;")}`;
    expect(parseEFatura(xxe).ok).toBe(false);
    expect(parseEFatura(EARSIV.replace(/<cac:LegalMonetaryTotal>[\s\S]*<\/cac:LegalMonetaryTotal>/, "")).ok).toBe(false);
    expect(parseEFatura(EARSIV.replace(">4250.5<", ">abc<")).ok).toBe(false);
    expect(parseEFatura(EARSIV.replace(">2026-10-05<", ">05.10.2026<")).ok).toBe(false);
  });
});
