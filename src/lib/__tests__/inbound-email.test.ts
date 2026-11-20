import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decodeDataUri,
  extractReplyText,
  findInvoiceNumber,
  htmlToText,
  organizationFromRecipients,
  parseAddress,
  replyToAddress,
  verifySvixSignature,
} from "@/lib/domain/inbound-email";

const ORG = "00000000-0000-4000-8000-000000000001";

describe("routing", () => {
  it("round-trips the organization through the reply-to address", () => {
    const addr = replyToAddress(ORG, "reply.alacore.app");
    expect(organizationFromRecipients([`Alacore <${addr}>`], "reply.alacore.app")).toBe(ORG);
    expect(organizationFromRecipients(["someone@else.com", addr.toUpperCase()], "reply.alacore.app")).toBe(ORG);
    expect(organizationFromRecipients([addr], "other.domain")).toBeNull();
    expect(organizationFromRecipients(["reply+not-a-uuid@reply.alacore.app"], "reply.alacore.app")).toBeNull();
  });
  it("parses display-name addresses", () => {
    expect(parseAddress('"Ahmet Yılmaz" <Ahmet@ABC.com>')).toEqual({ name: "Ahmet Yılmaz", email: "ahmet@abc.com" });
    expect(parseAddress("elif@kuzey.com.tr")).toEqual({ name: null, email: "elif@kuzey.com.tr" });
  });
});

describe("body extraction", () => {
  it("keeps only the new reply text in Turkish and English clients", () => {
    const tr = "Merhaba,\nÖdemeyi önümüzdeki cuma yapacağız.\n\n15 Eyl 2026 Pzt, 09:15 tarihinde Demo Teknoloji <finans@demo.com> şunu yazdı:\n> Faturamızın vadesi...";
    expect(extractReplyText(tr)).toBe("Merhaba,\nÖdemeyi önümüzdeki cuma yapacağız.");
    const en = "We will pay next Friday.\n-- \nJulia Weber\nNordwind";
    expect(extractReplyText(en)).toBe("We will pay next Friday.");
    expect(extractReplyText("Paid yesterday.\n\nOn Mon, Sep 15, 2026 at 9:15 AM Alacore wrote:\n> reminder")).toBe("Paid yesterday.");
  });
  it("turns HTML (including Resend data URIs) into text", () => {
    const html = "<div>Ödeme <b>yapıldı</b>.<br>Dekont ekte.</div><blockquote>eski mesaj</blockquote>";
    const uri = `data:text/html;base64,${Buffer.from(html).toString("base64")}`;
    expect(htmlToText(decodeDataUri(uri))).toBe("Ödeme yapıldı.\nDekont ekte.");
  });
  it("finds the invoice number from subject or body", () => {
    expect(findInvoiceNumber("Re: INV-2026-00182 numaralı fatura", "", ["INV-2026-00182", "INV-2026-00196"])).toBe("INV-2026-00182");
    expect(findInvoiceNumber("Re: ödeme", "inv-2026-00196 için", ["INV-2026-00182", "INV-2026-00196"])).toBe("INV-2026-00196");
    expect(findInvoiceNumber("Merhaba", "teşekkürler", ["INV-1"])).toBeNull();
  });
});

describe("svix signature", () => {
  const secret = "whsec_" + Buffer.from("super-secret-key-for-tests").toString("base64");
  const sign = (id: string, ts: string, body: string) =>
    "v1," + createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`${id}.${ts}.${body}`).digest("base64");
  const body = '{"type":"email.received"}';
  const now = 1_790_000_000;
  it("accepts a valid signature and rejects tampering, stale timestamps and missing headers", () => {
    const ts = String(now);
    expect(verifySvixSignature(secret, { id: "msg_1", timestamp: ts, signature: `v1,AAAA ${sign("msg_1", ts, body)}` }, body, now)).toBe(true);
    expect(verifySvixSignature(secret, { id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body) }, body + " ", now)).toBe(false);
    expect(verifySvixSignature(secret, { id: "msg_1", timestamp: String(now - 600), signature: sign("msg_1", String(now - 600), body) }, body, now)).toBe(false);
    expect(verifySvixSignature(secret, { id: null, timestamp: ts, signature: sign("msg_1", ts, body) }, body, now)).toBe(false);
    expect(verifySvixSignature("", { id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body) }, body, now)).toBe(false);
  });
});

describe("ERP import address", () => {
  const secret = "test-import-secret-0123456789";
  it("accepts only the address with the right token", async () => {
    const { importAddress, organizationFromImportRecipients, isTrustedAttachmentUrl, isStatementAttachment } = await import("@/lib/domain/inbound-email");
    const addr = importAddress(ORG, secret, "reply.alacore.app");
    expect(addr).toMatch(/^import\+00000000-0000-4000-8000-000000000001\.[0-9a-f]{20}@reply\.alacore\.app$/);
    expect(addr.split("@")[0].length).toBeLessThanOrEqual(64);
    expect(organizationFromImportRecipients([`LioXERP <${addr.toUpperCase()}>`], "reply.alacore.app", secret)).toBe(ORG);
    expect(organizationFromImportRecipients([`import+${ORG}.00000000000000000000@reply.alacore.app`], "reply.alacore.app", secret)).toBeNull();
    expect(organizationFromImportRecipients([addr], "reply.alacore.app", "other-secret")).toBeNull();
    expect(organizationFromImportRecipients([addr], "reply.alacore.app", "")).toBeNull();
    expect(organizationFromImportRecipients([replyToAddress(ORG, "reply.alacore.app")], "reply.alacore.app", secret)).toBeNull();
    expect(isTrustedAttachmentUrl("https://inbound-cdn.resend.com/x/attachments/y?signature=1")).toBe(true);
    expect(isTrustedAttachmentUrl("http://inbound-cdn.resend.com/x")).toBe(false);
    expect(isTrustedAttachmentUrl("https://169.254.169.254/latest")).toBe(false);
    expect(isTrustedAttachmentUrl("https://resend.com.evil.example/x")).toBe(false);
    expect(isStatementAttachment("Cari Ekstre.XLSX")).toBe(true);
    expect(isStatementAttachment("logo.png")).toBe(false);
  });
});
