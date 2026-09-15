import { Bot, ShieldCheck } from "lucide-react";
import { AiForm } from "@/components/settings/ai-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AI_AGENT_RULES, AI_AGENT_RULES_TR } from "@/lib/ai/system-prompt";
import { requireContext } from "@/lib/db";
import { hasOpenAI } from "@/lib/env";

export const metadata = { title: "AI settings" };

const COPY = {
  tr: { active: "Bağlı", fallback: "Kural tabanlı", rulesHint: "Her üretilen mesaj ve sınıflandırma bu kurallara göre denetlenir; ihlal eden çıktılar reddedilir." },
  en: { active: "Connected", fallback: "Rule-based", rulesHint: "Every generated message and classification is checked against these rules; violating output is rejected." },
};

export default async function AiSettingsPage() {
  const { t, locale, org } = await requireContext();
  const c = COPY[locale];
  const openai = hasOpenAI();
  const rules = locale === "tr" ? AI_AGENT_RULES_TR : AI_AGENT_RULES;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <AiForm org={org} t={t} locale={locale} />
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="size-4 text-muted-foreground" /> {t.settings.aiProvider}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Badge variant={openai ? "success" : "warning"} className="w-fit">{openai ? c.active : c.fallback}</Badge>
              <p className="text-xs text-muted-foreground">{openai ? t.settings.aiProviderConfigured : t.settings.aiProviderMissing}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-muted-foreground" /> {t.settings.aiRules}
              </CardTitle>
              <CardDescription>{c.rulesHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-1.5 text-sm">
                {rules.map((rule, i) => (
                  <li key={rule} className="flex gap-2.5">
                    <span className="w-5 shrink-0 text-right font-mono text-[11px] leading-5 text-muted-foreground tabular">{i + 1}.</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
