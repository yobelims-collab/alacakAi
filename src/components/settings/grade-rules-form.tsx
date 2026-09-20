"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { GradeBadge } from "@/components/app/grade-badge";
import { Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateGradeRulesAction, } from "@/lib/actions/settings";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { GRADES, type Grade } from "@/lib/types";

export function GradeRulesForm({ rules, t }: { rules: Record<Grade, string>; t: Dictionary }) {
  const [state, action] = useActionState(updateGradeRulesAction, {});
  useEffect(() => {
    if (state.success) toast.success(t.settings.saved);
  }, [state, t.settings.saved]);
  return (
    <form action={action} className="flex flex-col gap-3">
      {GRADES.map((g) => (
        <div key={g} className="grid gap-2 sm:grid-cols-[180px_1fr]">
          <GradeBadge grade={g} t={t} withLabel />
          <Textarea name={g} defaultValue={rules[g] ?? ""} rows={2} required minLength={3} maxLength={300} />
        </div>
      ))}
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      <div>
        <SubmitButton>{t.common.save}</SubmitButton>
      </div>
    </form>
  );
}
