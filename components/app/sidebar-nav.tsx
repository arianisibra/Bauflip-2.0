"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  CalendarDays,
  ChartColumnStacked,
  Clock3,
  Cog,
  FolderKanban,
  Gauge,
  Kanban,
  MessageSquare,
  PackageSearch,
  ScrollText,
  Settings2,
  Upload,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoleType, SidebarItem } from "@/lib/domain/types";

const iconByKey: Record<SidebarItem["key"], ComponentType<{ className?: string }>> = {
  uebersicht: Gauge,
  projekte: FolderKanban,
  kanban: Kanban,
  kontakte: Users,
  termine: CalendarDays,
  artikel: PackageSearch,
  rapporte: ScrollText,
  team_chat: MessageSquare,
  zeiterfassung: Clock3,
  bestellformular: ChartColumnStacked,
  einstellungen: Cog,
  integrationen: Settings2,
  import_export: Upload,
};

type SidebarNavProps = {
  role: RoleType;
  items: SidebarItem[];
};

export function SidebarNav({ role, items }: SidebarNavProps) {
  const pathname = usePathname();
  const grouped = {
    navigation: items.filter((item) => item.section === "navigation"),
    einsatz: items.filter((item) => item.section === "einsatz"),
    system: items.filter((item) => item.section === "system"),
  };

  const sectionTitle = {
    navigation: "Navigation",
    einsatz: "Einsatz",
    system: "System",
  };

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r bg-gradient-to-b from-sky-950 to-slate-950 px-4 py-5 text-slate-100">
      <div className="mb-8 flex items-center gap-3 px-2">
        <Image
          src="/Bauflip_Logo-removebg_white.png"
          alt="Bauflip"
          width={120}
          height={32}
          className="h-8 w-auto"
          priority
        />
      </div>

      <nav className="flex flex-col gap-5">
        {(Object.keys(grouped) as Array<keyof typeof grouped>).map((section) => (
          <div key={section} className="flex flex-col gap-2">
            <p className="px-2 text-xs font-semibold tracking-[0.14em] uppercase text-slate-400">
              {sectionTitle[section]}
            </p>
            {grouped[section].map((item) => {
              const Icon = iconByKey[item.key];
              const isActive =
                item.key === "kanban"
                  ? pathname === item.href || pathname.endsWith("/kanban")
                  : pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-cyan-400/20 text-cyan-100"
                      : "text-slate-200 hover:bg-slate-800/80 hover:text-white",
                  )}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
