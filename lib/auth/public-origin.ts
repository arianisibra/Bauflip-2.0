/**
 * Öffentliche Basisadresse für Weiterleitungen aus Auth-Routen.
 *
 * Hinter dem Reverse-Proxy ist `request.nextUrl.origin` die **interne** Adresse
 * (http://localhost:3000 bzw. :3001). Wer daraus eine Weiterleitung baut, schickt
 * den Nutzer auf einen Port, den es auf dessen Rechner nicht gibt — genau so sind
 * Einladungslinks reihenweise auf «localhost hat die Verbindung abgelehnt» gelaufen.
 *
 * `fallback` greift nur in der lokalen Entwicklung, wo NEXT_PUBLIC_SITE_URL fehlen darf.
 */
export function publicOrigin(fallback: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  return configured || fallback;
}
