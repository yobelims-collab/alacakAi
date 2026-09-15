import { PageHeader } from "@/components/app/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { requireContext } from "@/lib/db";

export const metadata = { title: "Settings" };

const SUBTITLE = { tr: "Şirket, kullanıcı, yapay zekâ ve otomasyon tercihleri", en: "Company, users, AI and automation preferences" };

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { t, locale } = await requireContext();
  return (
    <>
      <PageHeader title={t.settings.title} subtitle={SUBTITLE[locale]} />
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <SettingsNav t={t} />
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
      </div>
    </>
  );
}
