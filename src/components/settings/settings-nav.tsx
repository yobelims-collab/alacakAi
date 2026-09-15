"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Building2, CreditCard, MessageSquare, Users, Workflow } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

export function settingsNavItems(t: Dictionary) {
  return [
    { href: "/settings/company", label: t.settings.company, icon: Building2 },
    { href: "/settings/users", label: t.settings.users, icon: Users },
    { href: "/settings/ai", label: t.settings.ai, icon: Bot },
    { href: "/settings/communication", label: t.settings.communication, icon: MessageSquare },
    { href: "/settings/automation", label: t.settings.automation, icon: Workflow },
    { href: "/settings/billing", label: t.settings.billing, icon: CreditCard },
  ];
}

/** Settings sub-navigation: vertical list on desktop, horizontally scrollable pills on mobile. */
export function SettingsNav({ t }: { t: Dictionary }) {
  const pathname = usePathname();
  return (
    <nav aria-label={t.settings.title} className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
      {settingsNavItems(t).map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-2.5 py-2 text-sm whitespace-nowrap transition-colors",
              active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
