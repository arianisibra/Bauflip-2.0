/** Logos sind Kleinbilder (Upload-Grenze 2 MB). Mehr deutet auf Missbrauch hin. */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * Nur Objekte im eigenen Supabase-Storage als Logo-Quelle zulassen.
 *
 * `organizations.logo_url` ist eine gewöhnliche Datenbankspalte, die ein Admin
 * frei setzen kann. Der Abruf läuft SERVERSEITIG — also aus dem internen Netz
 * des Servers, nicht aus dem Browser. Ohne Einschränkung liesse sich damit
 * `http://169.254.169.254/…` oder ein lokaler Port ansprechen: Über Antwortzeit
 * und Erfolg lassen sich interne Dienste abtasten, und liefert einer davon ein
 * Bild, landet dessen Inhalt sichtbar im herunterladbaren PDF.
 *
 * Verglichen wird der vollständige Ursprung (Schema, Host, Port) — so gilt die
 * Regel in der Entwicklung mit lokalem Supabase genauso wie in der Produktion.
 */
export function istErlaubteLogoQuelle(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  if (!base) return false;
  try {
    const ziel = new URL(url);
    return (
      ziel.origin === new URL(base).origin &&
      ziel.pathname.startsWith("/storage/v1/object/public/")
    );
  } catch {
    return false;
  }
}
