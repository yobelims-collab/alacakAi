/**
 * Turns whatever was pasted into NEXT_PUBLIC_SUPABASE_URL into the project's API URL
 * (https://<ref>.supabase.co), so a common copy-paste slip does not keep the app in demo mode.
 * Accepted: the API URL itself (with or without https://, quotes, a trailing slash or /rest/v1),
 * the dashboard link (supabase.com/dashboard/project/<ref>), a bare project ref, or a Postgres
 * connection string (its password is never returned or echoed).
 */
export interface SupabaseUrlResult {
  url: string;
  /** Plain-language note when the value was corrected or cannot be used (never contains secrets). */
  note: string | null;
  valid: boolean;
}

const REF = /^[a-z0-9]{20}$/;

export function normalizeSupabaseUrl(raw: string | undefined | null): SupabaseUrlResult {
  let v = (raw ?? "").trim().replace(/^["'`]+|["'`]+$/g, "").trim();
  if (!v) return { url: "", note: null, valid: false };

  // Postgres connection string → project ref from db.<ref>.supabase.co or the pooler user postgres.<ref>.
  if (/^postgres(ql)?:\/\//i.test(v)) {
    const ref = v.match(/db\.([a-z0-9]{20})\.supabase\.co/i)?.[1] ?? v.match(/\/\/postgres\.([a-z0-9]{20})[:@]/i)?.[1];
    if (ref) return { url: `https://${ref.toLowerCase()}.supabase.co`, note: "A database connection string was pasted; the Project URL was derived from it. Replace it with the Project URL (Settings → API).", valid: true };
    return { url: "", note: "This looks like a database connection string, not the Project URL. Use Settings → API → Project URL (https://<ref>.supabase.co).", valid: false };
  }

  // Dashboard link → API URL.
  const dash = v.match(/supabase\.com\/dashboard\/project\/([a-z0-9]{20})/i);
  if (dash) return { url: `https://${dash[1].toLowerCase()}.supabase.co`, note: "The dashboard link was pasted; the Project URL was derived from it.", valid: true };

  if (REF.test(v)) return { url: `https://${v}.supabase.co`, note: "Only the project ref was pasted; the Project URL was derived from it.", valid: true };

  let note: string | null = null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) {
    v = `https://${v}`;
    note = "https:// was missing and has been added.";
  }
  v = v.replace(/\/+(rest|auth)\/v1\/?.*$/i, "").replace(/\/+$/, "");

  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return { url: "", note: "NEXT_PUBLIC_SUPABASE_URL is not a valid URL. Use Settings → API → Project URL (https://<ref>.supabase.co).", valid: false };
  }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !local) return { url: "", note: "NEXT_PUBLIC_SUPABASE_URL must start with https://", valid: false };
  if (u.username || u.password) return { url: "", note: "NEXT_PUBLIC_SUPABASE_URL must not contain a user name or password.", valid: false };
  return { url: `${u.protocol}//${u.host}`, note, valid: true };
}

/** API keys are often pasted with quotes or a "Bearer " prefix. */
export function cleanKey(raw: string | undefined | null): string {
  return (raw ?? "").trim().replace(/^["'`]+|["'`]+$/g, "").replace(/^Bearer\s+/i, "").trim();
}
