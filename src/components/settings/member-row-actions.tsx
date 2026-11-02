"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { removeMemberAction, updateMemberRoleAction } from "@/lib/actions/team";
import { INVITABLE_ROLES } from "@/lib/domain/roles";
import type { Locale, UserRole } from "@/lib/types";
import { ROLE_COPY } from "./team-copy";

const COPY = {
  tr: { roleChanged: "Rol güncellendi", removed: "Kullanıcı ekipten çıkarıldı", remove: "Çıkar", confirm: (n: string) => `${n} ekipten çıkarılsın mı? Atandığı müşteriler hesap yöneticisiz kalır.`, role: "Rol" },
  en: { roleChanged: "Role updated", removed: "Member removed", remove: "Remove", confirm: (n: string) => `Remove ${n} from the team? Customers assigned to them will have no account manager.`, role: "Role" },
};

export function MemberRoleSelect({ profileId, role, locale }: { profileId: string; role: UserRole; locale: Locale }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const c = COPY[locale];
  return (
    <Select
      aria-label={c.role}
      className="h-8 w-40"
      defaultValue={role}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        start(async () => {
          const r = await updateMemberRoleAction(profileId, next);
          if (r.ok) toast.success(c.roleChanged);
          else toast.error(r.error);
          router.refresh();
        });
      }}
    >
      {INVITABLE_ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_COPY[locale][r].label}
        </option>
      ))}
    </Select>
  );
}

export function RemoveMemberButton({ profileId, name, locale }: { profileId: string; name: string; locale: Locale }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const c = COPY[locale];
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(c.confirm(name))) return;
        start(async () => {
          const r = await removeMemberAction(profileId);
          if (r.ok) toast.success(c.removed);
          else toast.error(r.error);
          router.refresh();
        });
      }}
    >
      <Trash2 /> {c.remove}
    </Button>
  );
}
