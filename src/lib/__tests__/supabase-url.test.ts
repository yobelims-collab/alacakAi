import { describe, expect, it } from "vitest";
import { cleanKey, normalizeSupabaseUrl } from "@/lib/supabase-url";

const REF = "abcdefghijklmnopqrst";
const API = `https://${REF}.supabase.co`;

describe("normalizeSupabaseUrl", () => {
  it("keeps a correct Project URL as is", () => {
    expect(normalizeSupabaseUrl(API)).toEqual({ url: API, note: null, valid: true });
  });
  it("repairs common copy-paste slips", () => {
    expect(normalizeSupabaseUrl(`${REF}.supabase.co`)).toMatchObject({ url: API, valid: true });
    expect(normalizeSupabaseUrl(` "${API}/" `)).toMatchObject({ url: API, valid: true, note: null });
    expect(normalizeSupabaseUrl(`${API}/rest/v1/`)).toMatchObject({ url: API, valid: true });
    expect(normalizeSupabaseUrl(`https://supabase.com/dashboard/project/${REF}/settings/api`)).toMatchObject({ url: API, valid: true });
    expect(normalizeSupabaseUrl(REF)).toMatchObject({ url: API, valid: true });
  });
  it("derives the URL from a connection string without echoing the password", () => {
    const direct = normalizeSupabaseUrl(`postgresql://postgres:S3cret!@db.${REF}.supabase.co:5432/postgres`);
    expect(direct).toMatchObject({ url: API, valid: true });
    expect(JSON.stringify(direct)).not.toContain("S3cret");
    const pooler = normalizeSupabaseUrl(`postgresql://postgres.${REF}:S3cret!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`);
    expect(pooler).toMatchObject({ url: API, valid: true });
    expect(JSON.stringify(pooler)).not.toContain("S3cret");
  });
  it("rejects what cannot be used", () => {
    expect(normalizeSupabaseUrl("")).toMatchObject({ valid: false });
    expect(normalizeSupabaseUrl("http://example.com")).toMatchObject({ valid: false });
    expect(normalizeSupabaseUrl("not a url at all")).toMatchObject({ valid: false });
    expect(normalizeSupabaseUrl("https://user:pw@x.supabase.co")).toMatchObject({ valid: false });
    expect(normalizeSupabaseUrl("http://localhost:54321")).toMatchObject({ url: "http://localhost:54321", valid: true });
  });
  it("cleans pasted keys", () => {
    expect(cleanKey(' "Bearer abc.def.ghi" ')).toBe("abc.def.ghi");
  });
});
