"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, CalendarDays, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSessionProfile } from "@/components/app/session-profile-provider";

const tabs = [
  { href: "/tag", label: "Mein Tag", icon: CalendarDays },
  { href: "/wochenplan", label: "Kalender", icon: Calendar },
  { href: "/zeit", label: "Zeit", icon: Clock },
] as const;

function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]!}${parts[parts.length - 1]![0]!}`.toUpperCase();
}

export function TechBottomNav() {
  const pathname = usePathname();
  const profile = useSessionProfile();
  const profilActive = pathname === "/profil" || pathname.startsWith("/profil/");

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

        {/* Profil-Tab zeigt das eigene Profilbild statt eines generischen Icons. */}
        <Link
          href="/profil"
          prefetch={false}
          aria-current={profilActive ? "page" : undefined}
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-[11px] font-medium transition-colors",
            profilActive ? "text-primary" : "text-muted-foreground active:text-foreground",
          )}
        >
          <span
            className={cn(
              "relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted",
              profilActive ? "border-primary ring-2 ring-primary/30" : "border-border/80",
            )}
          >
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-[9px] font-semibold text-muted-foreground">
                {profileInitials(profile.displayName)}
              </span>
            )}
          </span>
          <span>Profil</span>
        </Link>
      </div>
    </nav>
  );
}
