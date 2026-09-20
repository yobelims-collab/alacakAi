import Link from "next/link";
import type { Grade } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2", className)} aria-label="AlacakAI">
      <span className="grid size-7 place-items-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">A</span>
      <span className="text-sm font-semibold tracking-tight">AlacakAI</span>
    </Link>
  );
}

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>{children}</div>;
}

export function SectionHeading({ eyebrow, title, sub, align = "center", className }: { eyebrow?: string; title: string; sub?: string; align?: "center" | "left"; className?: string }) {
  return (
    <div className={cn("max-w-2xl", align === "center" ? "mx-auto text-center" : "text-left", className)}>
      {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>}
      <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl lg:text-[2.125rem] lg:leading-[1.15]">{title}</h2>
      {sub && <p className="mt-3 text-pretty text-sm text-muted-foreground sm:text-base">{sub}</p>}
    </div>
  );
}

/** Same palette as the in-app GradeBadge, without the dictionary dependency. */
const GRADE_STYLE: Record<Grade, string> = {
  A: "bg-emerald-600 text-white",
  B: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-900",
  C: "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-900",
  D: "bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 border border-orange-200 dark:border-orange-900",
  E: "bg-red-600 text-white",
};

export function GradeChip({ grade, size = "sm", className }: { grade: Grade; size?: "sm" | "md" | "lg"; className?: string }) {
  const dims = size === "lg" ? "size-12 text-2xl rounded-lg" : size === "md" ? "size-9 text-base rounded-md" : "size-6 text-[12px] rounded-md";
  return <span className={cn("inline-grid shrink-0 place-items-center font-bold tabular", dims, GRADE_STYLE[grade], className)}>{grade}</span>;
}
