import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import { ThemeToggle } from "@/components/app/theme-toggle";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/types";

/** Centered card layout shared by the auth pages and onboarding. */
export function AuthShell({ t, locale, demo, children }: { t: Dictionary; locale: Locale; demo: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">A</span>
          <span className="text-sm font-semibold tracking-tight">{t.appName}</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher locale={locale} />
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:py-12">
        <div className="flex w-full max-w-md flex-col gap-4">
          {demo && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-100">
              <FlaskConical className="mt-0.5 size-3.5 shrink-0" />
              <p>
                <span className="font-medium">{t.common.demoMode}.</span> {t.common.demoModeHint}
              </p>
            </div>
          )}
          {children}
        </div>
      </main>
      <footer className="px-4 py-4 text-center text-[11px] text-muted-foreground">© 2026 AlacakAI</footer>
    </div>
  );
}
