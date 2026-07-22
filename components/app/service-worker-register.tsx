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
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("[bauflip] Service-Worker-Registrierung fehlgeschlagen", err);
    });
  }, []);

  return null;
}
