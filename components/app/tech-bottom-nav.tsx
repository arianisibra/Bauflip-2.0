"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, CalendarDays, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/tag", label: "Mein Tag", icon: CalendarDays },
  { href: "/wochenplan", label: "Kalender", icon: Calendar },
  { href: "/profil", label: "Profil", icon: UserRound },
] as const;

export function TechBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 w-full border-t border-border bg-card/95 pb-safe shadow-[0_-1px_3px_rgba(0,0,0,0.06)] backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-center justify-around px-4 py-2">
        {tabs.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl px-3 py-2.5 text-[11px] font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground",
              )}
            >
              <Icon
                className={cn("size-5", active && "stroke-[2.5]")}
                aria-hidden
              />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
