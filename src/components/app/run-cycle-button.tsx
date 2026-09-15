"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resetDemoAction, runCycleAction } from "@/lib/actions/collection";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function RunCycleButton({ t, variant = "brand" }: { t: Dictionary; variant?: "brand" | "outline" | "default" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      size="sm"
      disabled={pending}
      title={t.common.runAiHint}
      onClick={() =>
        start(async () => {
          const r = await runCycleAction();
          if (!r.ok || !r.data) {
            toast.error(r.error ?? "Error");
            return;
          }
          const s = r.data;
          toast.success(`${t.common.runAi}: ${s.drafted} ${t.actionType.REMINDER_DRAFTED.toLowerCase()}, ${s.sent} ${t.actionType.REMINDER_SENT.toLowerCase()}, ${s.escalated} ${t.actionType.ESCALATION.toLowerCase()}, ${s.promisesBroken} ${t.actionType.PROMISE_BROKEN.toLowerCase()}`);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Play />}
      {t.common.runAi}
    </Button>
  );
}

export function ResetDemoButton({ t }: { t: Dictionary }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await resetDemoAction();
          if (!r.ok) toast.error(r.error ?? "Error");
          else toast.success(t.common.resetDemo);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
      {t.common.resetDemo}
    </Button>
  );
}
