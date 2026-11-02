"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import { LogoMark, Wordmark } from "@/components/app/logo";
import type { Locale } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { LandingCopy } from "./copy";

const ANCHORS = ["#how", "#features", "#pricing", "#faq"];

/** True once the dark full-screen hero has scrolled out from under the navigation. */
function usePastHero(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("scroll", onChange, { passive: true });
      window.addEventListener("resize", onChange);
      return () => {
        window.removeEventListener("scroll", onChange);
        window.removeEventListener("resize", onChange);
      };
    },
    () => window.scrollY > Math.max(window.innerHeight, 620) - 72,
    () => false,
  );
}

/**
 * Floating pill navigation. Over the dark hero it uses dark pills and a white CTA (as in the
 * reference); over the light sections it turns into light frosted pills with the brand CTA.
 */
export function PillNav({ copy, nav, locale, signedIn }: { copy: LandingCopy["hero"]; nav: LandingCopy["nav"]; locale: Locale; signedIn: boolean }) {
  const light = usePastHero();
  const pill = cn(
    "rounded-full border backdrop-blur transition-colors duration-300",
    light ? "border-border/80 bg-card/92 shadow-md shadow-black/5 backdrop-saturate-150" : "border-transparent bg-[#07111f]/90",
  );
  const link = cn("transition-colors", light ? "text-muted-foreground hover:text-foreground" : "text-neutral-300 hover:text-white");

  return (
    <div className="fixed left-0 right-0 top-0 z-50 px-4 pt-4 md:px-10 md:pt-6">
      <nav className="flex items-center justify-between gap-4" aria-label="Primary">
        <Link href="/" aria-label="Alacore" className={cn(pill, "flex items-center gap-2 py-2.5 pl-3 pr-5")}>
          <LogoMark className="size-6" />
          <Wordmark size="sm" onDark={!light} />
        </Link>

        <div className={cn(pill, "hidden items-center gap-1 px-3 py-2 md:flex")}>
          {copy.links.map((label, i) => (
            <a key={label} href={ANCHORS[i]} className={cn(link, "rounded-full px-5 py-2 text-sm")}>
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className={cn(pill, "hidden items-center gap-1 py-1.5 pl-1.5 pr-4 sm:flex")}>
            <LanguageSwitcher locale={locale} onDark={!light} className={light ? "rounded-full border-transparent bg-transparent" : undefined} />
            {!signedIn && (
              <Link href="/login" className={cn(link, "ml-2 text-sm")}>
                {nav.signIn.toLocaleLowerCase(locale)}
              </Link>
            )}
          </div>
          <Link
            href={signedIn ? "/inbox" : "/signup"}
            className={cn(
              "rounded-full px-6 py-3 text-sm transition-colors duration-300",
              light ? "bg-cta-gradient text-brand-foreground shadow-sm shadow-cta-to/20 hover:brightness-110" : "bg-white text-[#0f1f3a] hover:bg-neutral-200",
            )}
          >
            {(signedIn ? nav.inbox : nav.start).toLocaleLowerCase(locale)}
          </Link>
        </div>
      </nav>
    </div>
  );
}
