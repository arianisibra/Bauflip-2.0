"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type MobileContextSwitchProps = {
  className?: string;
  onNavigate?: () => void;
};

export function MobileContextSwitch({ className, onNavigate }: MobileContextSwitchProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isTagContext = pathname === "/tag" || pathname.startsWith("/tag/");

  const navigateTo = (href: "/projekte" | "/tag") => {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      onNavigate?.();
      return;
    }
    router.push(href);
    onNavigate?.();
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-border/80 bg-muted/70 p-1 md:hidden",
        className,
      )}
      role="tablist"
      aria-label="Ansicht wechseln"
    >
      <button
        type="button"
        role="tab"
        aria-selected={!isTagContext}
        className={cn(
          "min-h-9 rounded-lg px-3 text-xs font-semibold tracking-tight transition-colors",
          !isTagContext ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
        )}
        onClick={() => navigateTo("/projekte")}
      >
        Admin
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isTagContext}
        className={cn(
          "min-h-9 rounded-lg px-3 text-xs font-semibold tracking-tight transition-colors",
          isTagContext ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
        )}
        onClick={() => navigateTo("/tag")}
      >
        Tag
      </button>
    </div>
  );
}
