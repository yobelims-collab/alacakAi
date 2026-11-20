import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { STATEMENT_XML } from "./fixtures/cari-ekstre";

vi.mock("server-only", () => ({}));

const WEBHOOK_SECRET = "whsec_" + Buffer.from("route-test-webhook-secret").toString("base64");
const ORG = "00000000-0000-4000-8000-000000000001"; // demo organization

function signed(body: string) {
  const id = `msg_${Math.random()}`;
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = "v1," + createHmac("sha256", Buffer.from(WEBHOOK_SECRET.slice(6), "base64")).update(`${id}.${ts}.${body}`).digest("base64");
  return { "content-type": "application/json", "svix-id": id, "svix-timestamp": ts, "svix-signature": sig };
}

describe("POST /api/inbound/resend — automatic ERP import", () => {
  const realFetch = globalThis.fetch;
  beforeAll(() => {
    Object.assign(process.env, { DEMO_MODE: "true", RESEND_WEBHOOK_SECRET: WEBHOOK_SECRET, INBOUND_EMAIL_DOMAIN: "in.example.test", RESEND_API_KEY: "re_test_dummy", INBOUND_IMPORT_SECRET: "route-test-import-secret" });
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("https://api.resend.com/emails/receiving/em_1/attachments")) {
        return Response.json({ object: "list", has_more: false, data: [
          { id: "a1", filename: "Cari Ekstre.xml", size: STATEMENT_XML.length, content_type: "text/xml", download_url: "https://inbound-cdn.resend.com/em_1/attachments/a1?signature=x" },
          { id: "a2", filename: "logo.png", size: 100, content_type: "image/png", download_url: "https://inbound-cdn.resend.com/em_1/attachments/a2?signature=x" },
          { id: "a3", filename: "evil.xml", size: 10, content_type: "text/xml", download_url: "https://169.254.169.254/latest/meta-data" },
        ] });
      }
      if (url.startsWith("https://inbound-cdn.resend.com/em_1/attachments/a1")) return new Response(STATEMENT_XML);
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;
  });
  afterAll(() => {
    globalThis.fetch = realFetch;
  });

  it("imports the statement for the company whose secret address received it, and rejects a wrong token", async () => {
    const { NextRequest } = await import("next/server");
    const { POST } = await import("@/app/api/inbound/resend/route");
    const { importAddress } = await import("@/lib/domain/inbound-email");
    const { systemContextFor } = await import("@/lib/services/system-context");
    const to = importAddress(ORG, "route-test-import-secret", "in.example.test");

    const event = (recipient: string, emailId = "em_1") => JSON.stringify({ type: "email.received", created_at: new Date().toISOString(), data: { email_id: emailId, from: "LioXERP <erp@seller.example>", to: [recipient], subject: "Cari Ekstre", attachments: [] } });
    const post = (body: string) => POST(new NextRequest("http://localhost/api/inbound/resend", { method: "POST", body, headers: signed(body) }));

    const res = await post(event(to));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.import).toEqual([{ file: "Cari Ekstre.xml", ok: true, error: null, invoices: 8, payments: expect.any(Number) }]);
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes("169.254.169.254"))).toBe(false);
    expect(calls.some((u) => u.includes("/a2"))).toBe(false);

    const ctx = await systemContextFor(ORG);
    const imported = (await ctx!.store.list("invoices")).filter((i) => i.source === "ERP");
    expect(imported).toHaveLength(8);

    const wrong = to.replace(/\.[0-9a-f]{20}@/, ".00000000000000000000@");
    const res2 = await post(event(wrong, "em_2"));
    expect(await res2.json()).toMatchObject({ ignored: "no reply+ recipient" });
  });
});
