import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export const DEMO_SESSION_COOKIE = "alacakai_demo_session";

/**
 * Demo-mode sessions are an HMAC-signed cookie carrying the in-memory user id.
 * This exists only so the product works without Supabase; it is not a production auth system.
 */
function secret(): string {
  return env.sessionSecret || "alacakai-demo-secret-change-me";
}

export function signDemoSession(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, iat: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyDemoSession(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as { uid?: string };
    return typeof parsed.uid === "string" ? parsed.uid : null;
  } catch {
    return null;
  }
}
