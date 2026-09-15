import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { runCollectionCycle } from "@/lib/services/collection-service";
import { listOrganizationIds, systemContextFor } from "@/lib/services/system-context";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  if (!env.cronSecret) return false;
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(env.cronSecret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Daily collection sweep for every organization. Protect with CRON_SECRET
 * (Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically).
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const results: Record<string, unknown> = {};
  for (const orgId of await listOrganizationIds()) {
    const ctx = await systemContextFor(orgId);
    if (!ctx) continue;
    try {
      results[orgId] = await runCollectionCycle(ctx, { trigger: "cron" });
    } catch (err) {
      results[orgId] = { error: err instanceof Error ? err.message : "failed" };
    }
  }
  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), results });
}

export const POST = GET;
