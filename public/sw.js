// Handgeschriebener Service Worker (kein Build-Schritt) — Next.js 16 baut mit Turbopack,
// das von den gängigen SW-Build-Plugins (z. B. @serwist/next) noch nicht unterstützt wird.
//
// Aufgabe: die App-Hülle (JS/CSS, zuletzt besuchte Seiten) offline verfügbar machen, damit
// Monteure ohne Netz zumindest sehen, was sie vorher schon geladen hatten. Schreibvorgänge
// (Server Actions = POST) werden bewusst NICHT abgefangen — die bleiben online-only, bis
// Phase 2 (Offline-Warteschlange für Rapporte/Fotos) das übernimmt.

const CACHE_VERSION = "bauflip-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("bauflip-") && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function isSameOrigin(url) {
  return new URL(url).origin === self.location.origin;
}

function isStaticAsset(url) {
  return new URL(url).pathname.startsWith("/_next/static/");
}

/** Netzwerk zuerst, bei Fehler letzte gecachte Antwort — für Seiten/Navigation. */
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

/** Cache zuerst — für unveränderliche, hash-benannte Build-Assets. */
async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Nur GET, nur eigene Herkunft — Server Actions (POST) und Drittanbieter
  // (Supabase, Sentry, Anthropic …) unangetastet lassen.
  if (request.method !== "GET" || !isSameOrigin(request.url)) return;

  if (isStaticAsset(request.url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  }
});
