import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MemberRoleSelect, RemoveMemberButton } from "@/components/settings/member-row-actions";
import { ROLE_COPY } from "@/components/settings/team-copy";
import { TeamForm } from "@/components/settings/team-form";
import { requireContext } from "@/lib/db";
import { canManage } from "@/lib/domain/roles";
import { env } from "@/lib/env";
import type { UserRole } from "@/lib/types";

export const metadata = { title: "Users" };

const ROLE_VARIANT: Record<UserRole, BadgeVariant> = { OWNER: "default", ADMIN: "violet", FINANCE: "info", SALES: "neutral", VIEWER: "neutral" };

const COPY = {
  tr: {
    members: "Ekip üyeleri",
    membersHint: "Bu şirkete erişimi olan kullanıcılar. Rolleri yalnızca sahip ve yöneticiler değiştirebilir.",
    name: "Ad Soyad",
    email: "E-posta",
    role: "Rol",
    actions: "İşlemler",
    you: "siz",
    readOnly: "Ekibi yalnızca sahip veya yöneticiler yönetebilir.",
  },
  en: {
    members: "Team members",
    membersHint: "Users who can access this company. Only owners and admins can change roles.",
    name: "Name",
    email: "Email",
    role: "Role",
    actions: "Actions",
    you: "you",
    readOnly: "Only owners and admins can manage the team.",
  },
};

export default async function UsersSettingsPage() {
  const ctx = await requireContext();
  const { t, locale, user, demo } = ctx;
  const c = COPY[locale];
  const roles = ROLE_COPY[locale];
  const manager = canManage(user.role);
  const profiles = await ctx.store.list("profiles", { orderBy: "created_at", ascending: true });
  const editable = (role: UserRole, id: string) => manager && role !== "OWNER" && id !== user.id;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{c.members}</CardTitle>
          <CardDescription>{c.membersHint}</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">{c.name}</TableHead>
                <TableHead>{c.email}</TableHead>
                <TableHead>{c.role}</TableHead>
                {manager && <TableHead className="pr-5 text-right">{c.actions}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="pl-5 font-medium">
                    {p.full_name || "—"}
                    {p.id === user.id && <span className="ml-1.5 text-xs text-muted-foreground">({c.you})</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.email}</TableCell>
                  <TableCell>
                    {editable(p.role, p.id) ? (
                      <MemberRoleSelect profileId={p.id} role={p.role} locale={locale} />
                    ) : (
                      <Badge variant={ROLE_VARIANT[p.role]}>{roles[p.role].label}</Badge>
                    )}
                  </TableCell>
                  {manager && (
                    <TableCell className="pr-5 text-right">
                      {editable(p.role, p.id) ? <RemoveMemberButton profileId={p.id} name={p.full_name || p.email} locale={locale} /> : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {profiles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={manager ? 4 : 3} className="py-8 text-center text-muted-foreground">{t.common.noData}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {manager ? <TeamForm locale={locale} demo={demo} loginUrl={`${env.appUrl.replace(/\/+$/, "")}/login`} /> : <p className="text-xs text-muted-foreground">{c.readOnly}</p>}
    </>
  );
}
