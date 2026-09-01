/**
 * Gemeinsame Vertragsdefinition zwischen Browser-Sammler
 * (`instrumentation-client.ts`) und Gegenstelle (`app/api/browser-log/route.ts`).
 *
 * Entstanden am 31.08.2026: Beim Ausfall 17:10–17:39 sah ich nur die Server-Seite.
 * Ob der Browser des Kunden abbrach oder auf den Server wartete, ob nebenher ein
 * React-Fehler lief — alles Vermutung. Diese Datei schliesst die Lücke.
 *
 * Absichtlich NICHT erfasst: Formularinhalte, Antwortkörper, Header, Cookies.
 */

/** Höchstzahl Meldungen pro Seitenaufruf. Verhindert, dass ein Fehler in einer
 *  Schleife das Server-Log flutet — beim Kalender-Fehler am 31.08. liefen in
 *  Sekunden dutzende identische Meldungen auf. */
export const MAX_EVENTS_PRO_SEITE = 20;

/** Höchstzahl Meldungen pro Anfrage (Gegenstelle prüft unabhängig nach). */
export const MAX_EVENTS_PRO_ANFRAGE = MAX_EVENTS_PRO_SEITE;

/** Netzwerk erst ab hier melden — nicht jedes Bild und jede Schriftart. */
export const NETZWERK_SCHWELLE_MS = 2000;

/** Grösster akzeptierter Anfragekörper. Darüber wird verworfen, nicht gelesen. */
export const MAX_KOERPER_BYTES = 16 * 1024;

/** Längenbegrenzung für jedes einzelne Textfeld. */
export const MAX_TEXT_LAENGE = 500;

export type BrowserEventArt = "error" | "rejection" | "console" | "slow_request";

export type BrowserEvent = {
  art: BrowserEventArt;
  /** Fehlertext bzw. angefragte URL. */
  text: string;
  /** Quelldatei:Zeile bei Fehlern, Dauer in ms bei Netzwerk. */
  quelle?: string;
  dauerMs?: number;
  status?: number;
  stack?: string;
};

export type BrowserLogPayload = {
  /** Seite, auf der es passierte. */
  seite: string;
  events: BrowserEvent[];
};
