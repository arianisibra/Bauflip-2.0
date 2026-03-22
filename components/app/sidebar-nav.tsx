"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, FolderKanban, LayoutGrid, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/anfrage/neu", label: "Neue Anfrage", icon: ClipboardList },
  { href: "/projekte", label: "Projekte", icon: FolderKanban },
  { href: "/kunden", label: "Kunden", icon: Users },
];

export function SidebarNav() {
  const pathname = usePathname();

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

      <nav className="flex flex-col gap-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
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
      </nav>

      <div className="mt-auto rounded-xl border border-cyan-300/20 bg-sky-900/40 p-3 text-xs">
        <p className="font-medium text-cyan-100">Geführter Ablauf aktiv</p>
        <p className="mt-1 text-slate-200">
          Status und Pflichtangaben steuern die nächsten Schritte automatisch.
        </p>
      </div>
    </aside>
  );
}
