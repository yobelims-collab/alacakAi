import { AppShell } from "@/components/app/app-shell";
import { signOutAction } from "@/lib/auth/actions";
import { requireContext } from "@/lib/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const attention = (await ctx.store.list("ai_actions", { where: { status: "NEEDS_HUMAN" } })).length;
  return (
    <AppShell t={ctx.t} locale={ctx.locale} orgName={ctx.org.name} userName={ctx.user.full_name} userEmail={ctx.user.email} demo={ctx.demo} counts={{ attention }} signOut={signOutAction}>
      {children}
    </AppShell>
  );
}
