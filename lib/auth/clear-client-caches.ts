"use client";

/**
 * Räumt den Service-Worker-Laufzeit-Cache vor der Abmeldung — der Cache
 * enthält gerenderte SSR-Seiten samt Organisationsdaten (networkFirst in
 * public/sw.js). Ohne dieses Leeren bleiben sie im Cache Storage des Geräts
 * liegen; auf einem geteilten oder als Nächstes von einer anderen Person
 * genutzten Gerät würde ein Offline-Aufruf noch die Daten des vorherigen
 * Kontos zeigen (networkFirst fällt bei Netzwerkfehler auf den Cache zurück).
 */
export async function clearBauflipRuntimeCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key.startsWith("bauflip-")).map((key) => caches.delete(key)),
    );
  } catch {
    // Best-effort — ein Fehler beim Cache-Löschen darf die Abmeldung nicht blockieren.
  }
}
