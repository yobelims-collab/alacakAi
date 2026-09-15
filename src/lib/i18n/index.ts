import { cookies, headers } from "next/headers";
import type { Locale } from "@/lib/types";
import { dictionaries, type Dictionary } from "./dictionaries";

export const LOCALE_COOKIE = "alacakai_locale";
export const LOCALES: Locale[] = ["tr", "en"];

export function isLocale(v: unknown): v is Locale {
  return v === "tr" || v === "en";
}

/** Server-side locale resolution: cookie → Accept-Language → Turkish. */
export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const accept = (await headers()).get("accept-language") ?? "";
  if (/^en\b/i.test(accept.trim())) return "en";
  return "tr";
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] as Dictionary;
}

export async function getT(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}
