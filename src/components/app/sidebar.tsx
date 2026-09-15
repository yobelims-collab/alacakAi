"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, CreditCard, FileText, LayoutDashboard, MessageSquare, Settings, ShieldAlert, Users } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

export function navItems(t: Dictionary, counts: { attention: number }) {
  return [
    { href: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
    { href: "/attention", label: t.nav.attention, icon: ShieldAlert, badge: counts.attention },
    { href: "/customers", label: t.nav.customers, icon: Users },
    { href: "/invoices", label: t.nav.invoices, icon: FileText },
    { href: "/payments", label: t.nav.payments, icon: CreditCard },
    { href: "/communications", label: t.nav.communications, icon: MessageSquare },
    { href: "/ai-actions", label: t.nav.aiActions, icon: Bot },
    { href: "/settings", label: t.nav.settings, icon: Settings },
  ];
}

export function SidebarNav({ t, counts, onNavigate }: { t: Dictionary; counts: { attention: number }; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {navItems(t, counts).map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
              active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge ? <span className="rounded-full bg-red-600 px-1.5 text-[10px] font-semibold leading-4 text-white">{item.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
