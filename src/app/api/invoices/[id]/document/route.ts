import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storeForOrganization } from "@/lib/db";
import { readInvoiceDocumentBytes } from "@/lib/services/document-service";

export const dynamic = "force-dynamic";

/**
 * Streams an invoice's PDF to a signed-in member of the invoice's organization.
 * proxy.ts does not cover /api/, so auth is checked here; the org-scoped store makes
 * an invoice from another organization indistinguishable from a missing one (404).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.organization_id || !/^[\w-]{1,64}$/.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const store = await storeForOrganization(user.organization_id);
  const invoice = await store.get("invoices", id);
  if (!invoice) return NextResponse.json({ error: "not found" }, { status: 404 });
  const doc = await readInvoiceDocumentBytes({ store, org: { id: user.organization_id }, user: { id: user.id } }, invoice);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ascii = doc.filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new NextResponse(new Blob([doc.bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(doc.bytes.length),
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
