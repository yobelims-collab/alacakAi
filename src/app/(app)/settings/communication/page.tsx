import { Mail, MessageSquare } from "lucide-react";
import { CommunicationForm } from "@/components/settings/communication-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireContext } from "@/lib/db";
import { hasEmailProvider, hasWhatsAppProvider } from "@/lib/env";

export const metadata = { title: "Communication settings" };

const COPY = {
  tr: { emailEnv: "RESEND_API_KEY ile etkinleşir.", whatsappEnv: "WHATSAPP_ACCESS_TOKEN ve WHATSAPP_PHONE_NUMBER_ID ile etkinleşir." },
  en: { emailEnv: "Enabled by RESEND_API_KEY.", whatsappEnv: "Enabled by WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID." },
};

function ProviderCard({ icon: Icon, title, configured, envHint, t }: { icon: typeof Mail; title: string; configured: boolean; envHint: string; t: Awaited<ReturnType<typeof requireContext>>["t"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Badge variant={configured ? "success" : "warning"} className="w-fit">{configured ? t.settings.configured : t.settings.notConfigured}</Badge>
        <p className="text-xs text-muted-foreground">{envHint}</p>
      </CardContent>
    </Card>
  );
}

export default async function CommunicationSettingsPage() {
  const { t, locale, org } = await requireContext();
  const c = COPY[locale];
  const email = hasEmailProvider();
  const whatsapp = hasWhatsAppProvider();

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <CommunicationForm org={org} t={t} locale={locale} />
        <div className="flex flex-col gap-4">
          <ProviderCard icon={Mail} title={t.settings.emailProvider} configured={email} envHint={c.emailEnv} t={t} />
          <ProviderCard icon={MessageSquare} title={t.settings.whatsappProvider} configured={whatsapp} envHint={c.whatsappEnv} t={t} />
          {(!email || !whatsapp) && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{t.communications.providerNote}</p>}
        </div>
      </div>
    </>
  );
}
