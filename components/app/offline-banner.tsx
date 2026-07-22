"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";

/** Zeigt sich nur, wenn wirklich kein Netz da ist — zuletzt geladene Daten bleiben sichtbar. */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="flex shrink-0 items-center justify-center gap-1.5 bg-amber-500/15 px-4 py-1.5 text-center text-xs font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
      <WifiOff className="size-3.5 shrink-0" aria-hidden />
      Offline — zuletzt geladene Daten werden angezeigt
    </div>
  );
}
