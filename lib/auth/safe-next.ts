/**
 * Weiterleitungsziel aus einem `next`-Parameter absichern.
 *
 * Der Parameter steht in E-Mail-Links (Einladung, Passwort-Reset). Wer ihn frei
 * wählen darf, verschickt einen Link auf die ECHTE, vertraute Domäne, der nach
 * erfolgreicher Anmeldung auf eine fremde Seite führt — dort steht eine
 * nachgebaute Anmeldemaske. Zusammen mit einem gültigen eigenen Token ist das
 * zugleich eine Sitzungsübernahme: Das Opfer landet still in der Sitzung des
 * Angreifers und legt fortan Daten in dessen Konto an.
 *
 * Eine reine Zeichenkettenprüfung reicht dafür nicht. `/\evil.com` beginnt mit
 * einem Schrägstrich und nicht mit zwei — Browser deuten den Backslash aber wie
 * einen Schrägstrich und lesen daraus `//evil.com`, also eine fremde Domain.
 * Deshalb wird hier gegen den eigenen Ursprung aufgelöst statt gemustert.
 */
export const SAFE_NEXT_FALLBACK = "/onboarding";

/** Steuerzeichen (NUL–US) und DEL — in echten Pfaden nie, in Umgehungen oft. */
// eslint-disable-next-line no-control-regex
const STEUERZEICHEN = /[\u0000-\u001f\u007f]/;

export function safeNextPath(value: string | null | undefined, origin: string): string {
  if (!value) return SAFE_NEXT_FALLBACK;

  // Backslashes und Whitespace kommen in echten Pfaden nicht vor, dienen aber
  // dazu, die Prüfung zu umgehen.
  if (/[\\\s]/.test(value) || STEUERZEICHEN.test(value)) {
    return SAFE_NEXT_FALLBACK;
  }
  if (!value.startsWith("/") || value.startsWith("//")) {
    return SAFE_NEXT_FALLBACK;
  }

  try {
    const ziel = new URL(value, origin);
    if (ziel.origin !== new URL(origin).origin) return SAFE_NEXT_FALLBACK;
    return `${ziel.pathname}${ziel.search}${ziel.hash}`;
  } catch {
    return SAFE_NEXT_FALLBACK;
  }
}
