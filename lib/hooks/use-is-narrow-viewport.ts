"use client";

import { useSyncExternalStore } from "react";

/** Entspricht Tailwinds `sm`-Grenze — dieselbe Schwelle wie `sm:hidden`. */
const NARROW_QUERY = "(max-width: 639px)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(NARROW_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(NARROW_QUERY).matches;
}

/**
 * Ist das Fenster schmal (unter Tailwinds `sm`)?
 *
 * Gedacht für Listen, die zwei Darstellungen haben. Werden beide gerendert und
 * eine per CSS versteckt, hängt die versteckte trotzdem vollständig im DOM —
 * bei der Projektliste hob das die Virtualisierung der Tabelle auf, weil
 * daneben alle Zeilen als Karten lagen.
 *
 * Serverseitig wird `false` angenommen (breite Ansicht). Auf /projekte ist das
 * der Normalfall: Die Seite ist büro-only, Monteure landen auf «Mein Tag».
 * Schmale Fenster bekommen nach dem Hydrieren einen zusätzlichen Durchgang —
 * das ist der Preis dafür, dass die breite Ansicht nichts Unsichtbares mitträgt.
 */
export function useIsNarrowViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
