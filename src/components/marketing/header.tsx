import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/types";
import type { LandingCopy } from "./copy";
import { Container, Wordmark } from "./primitives";

export function MarketingHeader({ copy, locale, signedIn }: { copy: LandingCopy["nav"]; locale: Locale; signedIn: boolean }) {
  const links = [
    { href: "#how", label: copy.how },
    { href: "#features", label: copy.features },
    { href: "#pricing", label: copy.pricing },
    { href: "#faq", label: copy.faq },
  ];
  return (
    <header className="glass sticky top-0 z-40 border-b border-border/70">
      <Container className="flex h-14 items-center gap-4">
        <Wordmark />
        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <LanguageSwitcher locale={locale} className="hidden sm:inline-flex" />
          <ThemeToggle className="size-8" />
          {signedIn ? (
            <Button asChild size="sm" variant="brand">
              <Link href="/inbox">
                {copy.inbox} <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                <Link href="/login">{copy.signIn}</Link>
              </Button>
              <Button asChild size="sm" variant="brand">
                <Link href="/signup">{copy.start}</Link>
              </Button>
            </>
          )}
        </div>
      </Container>
    </header>
  );
}
