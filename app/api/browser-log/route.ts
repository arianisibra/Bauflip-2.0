import type { NextRequest } from "next/server";
import {
  MAX_EVENTS_PRO_ANFRAGE,
  MAX_KOERPER_BYTES,
  MAX_TEXT_LAENGE,
  type BrowserEvent,
} from "@/lib/observability/browser-log";

/**
 * Gegenstelle für den Browser-Mitschnitt aus `instrumentation-client.ts`.
 * Schreibt eine JSON-Zeile je Meldung nach stderr — dieselbe Form wie
 * `withSlowLog`, damit `scripts/perf/vorfall-bericht.sh` beides auswerten kann.
 *
 * Der Endpunkt ist NICHT angemeldet erreichbar (es gibt keine middleware.ts im
 * Projekt), also muss er sich selbst schützen: Grössenbegrenzung, Mengen-
 * begrenzung, Drosselung je Absender. Er antwortet immer 204 — auch bei Unsinn,
 * damit der Browser nie in eine Wiederholschleife läuft.
 *
 * Abschalten ohne Deploy: BROWSER_LOG=off in der Umgebung setzen und den Dienst
 * neu starten. Bewusst eine Server-Variable, keine NEXT_PUBLIC_ — die würde
 * beim Bauen fest eingebacken und liesse sich im Betrieb nicht mehr umlegen.
 */

const LEER = new Response(null, { status: 204 });

// ── Drosselung je Absender ───────────────────────────────────────
const FENSTER_MS = 60_000;
const MAX_ANFRAGEN_PRO_FENSTER = 60;
const zaehler = new Map<string, { anzahl: number; bis: number }>();

function zuVielAufEinmal(absender: string, jetzt: number): boolean {
  const eintrag = zaehler.get(absender);
  if (!eintrag || jetzt > eintrag.bis) {
    zaehler.set(absender, { anzahl: 1, bis: jetzt + FENSTER_MS });
    // Abgelaufene Einträge entfernen, damit die Map nicht unbegrenzt wächst.
    if (zaehler.size > 1000) {
      for (const [k, v] of zaehler) if (jetzt > v.bis) zaehler.delete(k);
    }
    return false;
  }
  eintrag.anzahl += 1;
  return eintrag.anzahl > MAX_ANFRAGEN_PRO_FENSTER;
}

function text(wert: unknown): string | undefined {
  if (typeof wert !== "string" || wert.length === 0) return undefined;
  return wert.length > MAX_TEXT_LAENGE ? wert.slice(0, MAX_TEXT_LAENGE) : wert;
}

function zahl(wert: unknown): number | undefined {
  return typeof wert === "number" && Number.isFinite(wert) ? Math.round(wert) : undefined;
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    if (process.env.BROWSER_LOG?.trim().toLowerCase() === "off") return LEER;

    const laenge = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(laenge) && laenge > MAX_KOERPER_BYTES) return LEER;

    const absender =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unbekannt";
    if (zuVielAufEinmal(absender, Date.now())) return LEER;

    const roh: unknown = await request.json();
    if (typeof roh !== "object" || roh === null) return LEER;

    const daten = roh as { seite?: unknown; events?: unknown };
    const seite = text(daten.seite) ?? "?";
    if (!Array.isArray(daten.events)) return LEER;

    for (const eintrag of daten.events.slice(0, MAX_EVENTS_PRO_ANFRAGE)) {
      if (typeof eintrag !== "object" || eintrag === null) continue;
      const e = eintrag as Partial<BrowserEvent>;
      const meldung = text(e.text);
      if (!meldung) continue;

      console.warn(
        JSON.stringify({
          type: "browser_log",
          art: typeof e.art === "string" ? e.art.slice(0, 20) : "unbekannt",
          seite,
          text: meldung,
          quelle: text(e.quelle),
          dauerMs: zahl(e.dauerMs),
          status: zahl(e.status),
          stack: text(e.stack),
        }),
      );
    }
  } catch {
    // Ein Fehler beim Mitschreiben darf nie nach aussen dringen.
  }
  return LEER;
}
