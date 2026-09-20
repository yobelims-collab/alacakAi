import { PackageX } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Grade } from "@/lib/types";
import { cn } from "@/lib/utils";

const GRADE_STYLE: Record<Grade, string> = {
  A: "bg-emerald-600 text-white",
  B: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  C: "bg-amber-100 text-amber-800 border border-amber-200",
  D: "bg-orange-100 text-orange-800 border border-orange-200",
  E: "bg-red-600 text-white",
};

/** The rating letter shown next to a customer everywhere. `size="lg"` for the customer card. */
export function GradeBadge({ grade, t, size = "sm", withLabel = false, onHold = false, className }: { grade: Grade | null | undefined; t: Dictionary; size?: "sm" | "lg"; withLabel?: boolean; onHold?: boolean; className?: string }) {
  if (!grade) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={`${t.grade.title}: ${grade} · ${t.grade[grade]}`}>
      <span className={cn("inline-grid place-items-center rounded-md font-bold tabular", size === "lg" ? "size-12 text-2xl" : "size-6 text-[12px]", GRADE_STYLE[grade])}>{grade}</span>
      {withLabel && <span className={cn("font-medium", size === "lg" ? "text-base" : "text-xs")}>{t.grade[grade]}</span>}
      {onHold && (
        <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-800" title={t.grade.shipmentsOnHold}>
          <PackageX className="size-3" /> {size === "lg" ? t.grade.shipmentsOnHold : null}
        </span>
      )}
    </span>
  );
}
