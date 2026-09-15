import { Mail, UserPlus } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireContext } from "@/lib/db";
import { USER_ROLES, type UserRole } from "@/lib/types";

export const metadata = { title: "Users" };

const ROLE_VARIANT: Record<UserRole, BadgeVariant> = { OWNER: "default", ADMIN: "violet", FINANCE: "info", SALES: "neutral", VIEWER: "neutral" };

const COPY = {
  tr: {
    members: "Ekip üyeleri",
    membersHint: "Bu şirkete erişimi olan kullanıcılar.",
    name: "Ad Soyad",
    you: "siz",
    inviteHint: "Bu sürümde kullanıcı davetleri uygulanmadı; e-posta ile davet gönderimi yol haritasındadır.",
    demoInviteHint: "Demo modunda e-posta sağlayıcısı olmadığı için davet gönderilemez.",
    send: "Davet gönder",
  },
  en: {
    members: "Team members",
    membersHint: "Users who can access this company.",
    name: "Name",
    you: "you",
    inviteHint: "User invitations are not implemented in this version; email invites are on the roadmap.",
    demoInviteHint: "Demo mode has no email provider, so invitations cannot be sent.",
    send: "Send invite",
  },
};

export default async function UsersSettingsPage() {
  const ctx = await requireContext();
  const { t, locale, user, demo } = ctx;
  const c = COPY[locale];
  const profiles = await ctx.store.list("profiles", { orderBy: "created_at", ascending: true });

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
                <TableHead>{t.auth.email}</TableHead>
                <TableHead className="pr-5">{t.settings.role}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="pl-5 font-medium">
                    {p.full_name}
                    {p.id === user.id && <span className="ml-1.5 text-xs text-muted-foreground">({c.you})</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.email}</TableCell>
                  <TableCell className="pr-5">
                    <Badge variant={ROLE_VARIANT[p.role]}>{p.role}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {profiles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">{t.common.noData}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-4 text-muted-foreground" /> {t.settings.inviteUser}
          </CardTitle>
          <CardDescription>{t.settings.invitePlaceholder}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <Field label={t.auth.email}>
              <Input type="email" name="email" placeholder="ad@sirket.com" disabled />
            </Field>
            <Field label={t.settings.role}>
              <Select name="role" defaultValue="FINANCE" disabled>
                {USER_ROLES.filter((r) => r !== "OWNER").map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            </Field>
            <Button type="button" variant="outline" disabled>
              <Mail /> {c.send}
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">{demo ? c.demoInviteHint : c.inviteHint}</p>
        </CardContent>
      </Card>
    </>
  );
}
