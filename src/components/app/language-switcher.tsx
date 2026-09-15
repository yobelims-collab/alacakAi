"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Globe } from "lucide-react";
import { setLocaleAction } from "@/lib/auth/actions";
import type { Locale } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ locale, className }: { locale: Locale; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (l: Locale) =>
    start(async () => {
      await setLocaleAction(l);
      router.refresh();
    });
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-md border bg-background p-0.5 text-xs", className)} aria-label="Language">
      <Globe className="ml-1.5 size-3.5 text-muted-foreground" />
      {(["tr", "en"] as Locale[]).map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          onClick={() => set(l)}
          className={cn("rounded px-2 py-1 font-medium uppercase transition-colors cursor-pointer", l === locale ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
