import Link from "next/link";
import type { LandingCopy } from "./copy";
import { Container, Wordmark } from "./primitives";

export function MarketingFooter({ copy, nav }: { copy: LandingCopy["footer"]; nav: LandingCopy["nav"] }) {
  return (
    <footer className="border-t bg-card/40">
      <Container className="py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <Wordmark />
            <p className="mt-3 text-sm text-muted-foreground">{copy.tagline}</p>
          </div>
          <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-3" aria-label="Footer">
            <div className="flex flex-col gap-2">
              <a href="#how" className="text-muted-foreground hover:text-foreground">{nav.how}</a>
              <a href="#features" className="text-muted-foreground hover:text-foreground">{nav.features}</a>
            </div>
            <div className="flex flex-col gap-2">
              <a href="#pricing" className="text-muted-foreground hover:text-foreground">{nav.pricing}</a>
              <a href="#faq" className="text-muted-foreground hover:text-foreground">{nav.faq}</a>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/login" className="text-muted-foreground hover:text-foreground">{copy.signIn}</Link>
              <Link href="/signup" className="text-muted-foreground hover:text-foreground">{copy.signUp}</Link>
              <a href="#privacy" className="text-muted-foreground hover:text-foreground">{copy.privacy}</a>
            </div>
          </nav>
        </div>
        <p className="mt-10 border-t pt-6 text-xs text-muted-foreground">{copy.rights}</p>
      </Container>
    </footer>
  );
}
