"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronDown, FlaskConical, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/types";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";
import { SidebarNav } from "./sidebar";

export interface ShellProps {
  t: Dictionary;
  locale: Locale;
  orgName: string;
  userName: string;
  userEmail: string;
  demo: boolean;
  counts: { attention: number };
  signOut: () => Promise<void>;
  children: ReactNode;
}

function Logo() {
  return (
    <Link href="/inbox" className="flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">A</span>
      <span className="text-sm font-semibold tracking-tight">AlacakAI</span>
    </Link>
  );
}

export function AppShell({ t, locale, orgName, userName, userEmail, demo, counts, signOut, children }: ShellProps) {
  const [open, setOpen] = useState(false);
  const sidebar = (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Logo />
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="size-4" />
        </button>
      </div>
      <div className="rounded-md border bg-muted/40 px-2.5 py-2">
        <p className="truncate text-xs font-medium">{orgName}</p>
        {demo && (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
            <FlaskConical className="size-3" /> {t.common.demoMode}
          </p>
        )}
      </div>
      <SidebarNav t={t} counts={counts} onNavigate={() => setOpen(false)} />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 border-r bg-card lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-card shadow-xl">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <div className="lg:hidden">
            <Logo />
          </div>
          {demo && (
            <span className="hidden items-center gap-1 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 text-[11px] font-medium text-amber-800 dark:text-amber-200 sm:inline-flex" title={t.common.demoModeHint}>
              <FlaskConical className="size-3" /> {t.common.demoMode}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher locale={locale} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <span className="grid size-6 place-items-center rounded-full bg-accent text-[11px] font-semibold">{userName.slice(0, 1).toUpperCase()}</span>
                  <span className="hidden max-w-32 truncate sm:inline">{userName}</span>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{userEmail}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">{t.nav.settings}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void signOut()}>
                  <LogOut /> {t.nav.signOut}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
