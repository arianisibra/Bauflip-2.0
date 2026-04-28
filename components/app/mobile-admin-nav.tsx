"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { MobileContextSwitch } from "@/components/app/mobile-context-switch";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { SidebarItem } from "@/lib/domain/types";

type MobileAdminNavProps = {
  items: SidebarItem[];
};

export function MobileAdminNav({ items }: MobileAdminNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Menü öffnen"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </Button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Menü"
        side="left"
        className="w-[85vw] max-w-sm border-r border-l-0 p-0"
      >
        <div className="-mx-5 -my-5 h-full">
          <div className="border-b border-border/70 bg-card/90 px-3 py-3">
            <MobileContextSwitch onNavigate={() => setOpen(false)} />
          </div>
          <SidebarNav items={items} mobile onNavigate={() => setOpen(false)} />
        </div>
      </Sheet>
    </>
  );
}
