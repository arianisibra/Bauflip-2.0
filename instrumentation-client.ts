/**
 * Sammelt im Browser, was in F12 unter "Console" und "Network" sichtbar wäre,
 * und schickt es an /api/browser-log. Läuft laut Next-Doku
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md)
 * NACH dem Laden des HTML, aber VOR der React-Hydration — nur deshalb erwischt
 * es auch Hydrationsfehler wie React #418, die ein Reporter innerhalb des
 * React-Baums verpasst.
 *
 * Oberste Regel: Diese Datei darf die App unter keinen Umständen mitreissen.
 * Jeder Zugriff steht in try/catch, jeder Fehler wird geschluckt. Ein kaputter
 * Mitschnitt ist ärgerlich; eine kaputte App ist ein Ausfall beim Kunden.
 */

import {
  MAX_EVENTS_PRO_SEITE,
  NETZWERK_SCHWELLE_MS,
  type BrowserEvent,
} from "@/lib/observability/browser-log";

const ENDPUNKT = "/api/browser-log";
const FLUSH_VERZOEGERUNG_MS = 2000;
const MAX_TEXT = 500;

let warteschlange: BrowserEvent[] = [];
let gesendet = 0;
const gesehen = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
/** Schutz vor Rekursion: solange wir selbst senden, nehmen wir nichts auf. */
let sendetGerade = false;

function kuerzen(wert: unknown): string {
  const s = typeof wert === "string" ? wert : String(wert);
  return s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}…` : s;
}

function melden(event: BrowserEvent): void {
  try {
    if (sendetGerade) return;
    if (gesendet >= MAX_EVENTS_PRO_SEITE) return;

    // Gleiche Meldung nur einmal. Ein Fehler in einer Render-Schleife feuert
    // sonst dutzende Male dieselbe Zeile.
    const schluessel = `${event.art}|${event.text}`;
    if (gesehen.has(schluessel)) return;
    gesehen.add(schluessel);

    gesendet += 1;
    warteschlange.push(event);

    if (flushTimer === null) {
      flushTimer = setTimeout(senden, FLUSH_VERZOEGERUNG_MS);
    }
  } catch {
    // bewusst still
  }
}

function senden(): void {
  try {
    flushTimer = null;
    if (warteschlange.length === 0) return;

    const paket = warteschlange;
    warteschlange = [];

    sendetGerade = true;
    try {
      const koerper = JSON.stringify({
        seite: kuerzen(window.location.pathname + window.location.search),
        events: paket,
      });

      // sendBeacon überlebt auch das Schliessen des Tabs und blockiert nichts.
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(ENDPUNKT, new Blob([koerper], { type: "application/json" }));
      } else {
        void fetch(ENDPUNKT, {
          method: "POST",
          body: koerper,
          keepalive: true,
          headers: { "Content-Type": "application/json" },
        }).catch(() => {});
      }
    } finally {
      sendetGerade = false;
    }
  } catch {
    // bewusst still
  }
}

try {
  // ── Console: unbehandelte Fehler ───────────────────────────────
  window.addEventListener("error", (e) => {
    try {
      const datei = e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined;
      melden({
        art: "error",
        text: kuerzen(e.message || "Unbekannter Fehler"),
        quelle: datei ? kuerzen(datei) : undefined,
        stack: e.error?.stack ? kuerzen(e.error.stack) : undefined,
      });
    } catch {
      // bewusst still
    }
  });

  // ── Console: abgelehnte Promises ───────────────────────────────
  window.addEventListener("unhandledrejection", (e) => {
    try {
      const grund = e.reason;
      melden({
        art: "rejection",
        text: kuerzen(grund instanceof Error ? grund.message : grund),
        stack: grund instanceof Error && grund.stack ? kuerzen(grund.stack) : undefined,
      });
    } catch {
      // bewusst still
    }
  });

  // ── Console: console.error ─────────────────────────────────────
  // React meldet Hydrationsfehler (#418) NUR hierüber, nicht über window.onerror.
  // Genau die suchen wir. Das Original wird immer zuerst und unverändert
  // aufgerufen — die Konsole des Entwicklers bleibt vollständig.
  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    originalError(...args);
    try {
      melden({ art: "console", text: kuerzen(args.map((a) => String(a)).join(" ")) });
    } catch {
      // bewusst still
    }
  };

  // ── Network: langsame Aufrufe ──────────────────────────────────
  // Nur fetch/XHR — Server Actions laufen als fetch auf die Seiten-URL, das ist
  // genau das, was am 31.08. 16 Sekunden hing. Bilder und Schriften bleiben aussen vor.
  if (typeof PerformanceObserver === "function") {
    const beobachter = new PerformanceObserver((liste) => {
      try {
        for (const eintrag of liste.getEntries()) {
          const r = eintrag as PerformanceResourceTiming;
          if (r.initiatorType !== "fetch" && r.initiatorType !== "xmlhttprequest") continue;
          if (r.duration < NETZWERK_SCHWELLE_MS) continue;
          melden({
            art: "slow_request",
            // Nur Pfad, keine Parameter — dort stehen bei uns Suchbegriffe.
            text: kuerzen(new URL(r.name, window.location.origin).pathname),
            dauerMs: Math.round(r.duration),
            status: typeof r.responseStatus === "number" ? r.responseStatus : undefined,
          });
        }
      } catch {
        // bewusst still
      }
    });
    beobachter.observe({ type: "resource", buffered: true });
  }

  // Beim Verlassen der Seite alles Ausstehende noch rausschicken.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") senden();
  });
} catch {
  // bewusst still
}
