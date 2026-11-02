import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Alacore wordmark: "Ala" in the logo navy (foreground token, so it flips in dark mode)
 * and "core" in the emerald→teal logo gradient. Vector text, crisp at any size.
 */
export function Wordmark({ size = "md", className }: { size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizes = { sm: "text-base", md: "text-lg", lg: "text-2xl", xl: "text-4xl" } as const;
  return (
    <span className={cn("select-none font-extrabold leading-none tracking-[-0.04em]", sizes[size], className)}>
      <span className="text-foreground">Ala</span>
      <span className="text-logo-gradient">core</span>
    </span>
  );
}

/** Square app mark (sidebar collapsed, favicon-like spots). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7 shrink-0", className)}>
      <defs>
        <linearGradient id="alacore-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--logo-from)" />
          <stop offset="100%" stopColor="var(--logo-to)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="#0f1f3a" />
      <path d="M9 24 L16 8 L23 24" fill="none" stroke="url(#alacore-mark)" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.2 18.6 H19.8" stroke="url(#alacore-mark)" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

/** Wordmark wrapped in a home link, used in headers. */
export function LogoLink({ href = "/", size = "md", className }: { href?: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <Link href={href} aria-label="Alacore" className={cn("inline-flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40", className)}>
      <Wordmark size={size} />
    </Link>
  );
}
