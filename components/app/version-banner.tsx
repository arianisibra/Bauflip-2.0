"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import {
  checkDeploymentVersion,
  getStaleDeploymentServerSnapshot,
  getStaleDeploymentSnapshot,
  subscribeStaleDeployment,
} from "@/lib/version/stale-deployment";

/** Regelmässige Prüfung, damit der Hinweis auch ohne fehlgeschlagene Aktion kommt. */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Zeigt nach einem Deploy einen Hinweis, dass der Tab neu geladen werden muss.
 * Ohne ihn laufen offene Fenster in tote Knöpfe (siehe lib/version/stale-deployment.ts).
 */
export function VersionBanner() {
  const isStale = useSyncExternalStore(
    subscribeStaleDeployment,
    getStaleDeploymentSnapshot,
    getStaleDeploymentServerSnapshot,
  );

  useEffect(() => {
    void checkDeploymentVersion();

    const check = () => void checkDeploymentVersion();
    globalThis.addEventListener("focus", check);
    const timer = setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      globalThis.removeEventListener("focus", check);
      clearInterval(timer);
    };
  }, []);

  if (!isStale) return null;

  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-300"
    >
      <span className="flex items-center gap-2">
        <RefreshCw className="size-4 shrink-0" aria-hidden />
        Neue Version verfügbar — bitte die Seite neu laden, sonst funktionieren
        Speichern und andere Aktionen nicht mehr.
      </span>
      <button
        type="button"
        className="shrink-0 rounded-md border border-amber-500/50 px-2.5 py-1 font-medium underline-offset-2 hover:bg-amber-500/20"
        onClick={() => globalThis.location.reload()}
      >
        Jetzt neu laden
      </button>
    </div>
  );
}
