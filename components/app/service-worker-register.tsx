"use client";

import { useEffect } from "react";

/**
 * Registriert den Service Worker (public/sw.js) für Offline-Zugriff auf zuletzt
 * geladene Seiten/Assets. Läuft in allen Umgebungen — bei aktiver Entwicklung kann
 * ein Hard-Reload nötig sein, wenn gecachte Assets veraltet wirken.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // Deployment-Kennung an die SW-URL hängen: Der Worker leitet daraus seine
    // Cache-Namen ab. Ändert sich die Kennung, holt der Browser den Worker neu
    // und dieser räumt beim Aktivieren die Caches der Vorversion weg. Ohne das
    // wüchse der Cache mit jedem Deploy weiter, ohne je etwas freizugeben.
    const version = process.env.NEXT_PUBLIC_DEPLOYMENT_ID || "dev";
    navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(version)}`).catch((err) => {
      console.error("[bauflip] Service-Worker-Registrierung fehlgeschlagen", err);
    });
  }, []);

  return null;
}
