"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resolveActionAction } from "@/lib/actions/collection";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function ResolveButton({ id, t }: { id: string; t: Dictionary }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await resolveActionAction(id);
          if (!r.ok) toast.error(r.error ?? "Error");
          else toast.success(t.aiActions.markResolved);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Check />} {t.aiActions.resolve}
    </Button>
  );
}
