"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Globe } from "lucide-react";
import { setLocaleAction } from "@/lib/auth/actions";
import type { Locale } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ locale, className, onDark = false }: { locale: Locale; className?: string; onDark?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (l: Locale) =>
    start(async () => {
      await setLocaleAction(l);
      router.refresh();
    });
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-md border p-0.5 text-xs", onDark ? "rounded-full border-transparent bg-transparent" : "bg-background", className)} aria-label="Language">
      <Globe className={cn("ml-1.5 size-3.5", onDark ? "text-neutral-400" : "text-muted-foreground")} />
      {(["tr", "en"] as Locale[]).map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          onClick={() => set(l)}
          className={cn("rounded px-2 py-1 font-medium uppercase transition-colors cursor-pointer", l === locale ? (onDark ? "rounded-full bg-white text-[#0f1f3a]" : "bg-primary text-primary-foreground") : onDark ? "rounded-full text-neutral-300 hover:text-white" : "text-muted-foreground hover:text-foreground")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
