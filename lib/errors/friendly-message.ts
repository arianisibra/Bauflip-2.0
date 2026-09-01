/**
 * Next.js ersetzt bei Fehlern, die während des Server-/RSC-Renderings auftreten,
 * die echte `error.message` in Production automatisch durch einen englischen
 * Platzhaltertext ("...omitted in production builds..."). In minifizierten
 * Production-Builds erscheint dieser Fehler aber typischerweise NICHT ausgeschrieben,
 * sondern als komprimierter React-Fehlercode ("Minified React error #441; visit
 * https://react.dev/errors/441 ..."). Code #441 IST exakt dieser Redaction-Fehler
 * (verifiziert gegen https://react.dev/errors/441) — beide Formen landen unverändert
 * in `error.message`, wenn wir sie selbst per try/catch abfangen (Next.js' eigene
 * Fehler-UI decodiert #441 zwar intern zum ausgeschriebenen Satz, unser Code sieht
 * aber nur den rohen `.message`-Wert). Ohne diesen Filter landet einer der beiden
 * rohen/englischen Texte 1:1 in unseren Toasts/Fehlermeldungen, obwohl der
 * ursprüngliche, für Nutzer verständliche deutsche Fehlertext (z. B. aus
 * validateOrderFormValues) nie ankommt — er wurde vorher von Next.js redigiert.
 */
const NEXT_REDACTED_MESSAGE_MARKERS = [
  "omitted in production builds",
  "minified react error",
];

function isRedactedByNextjs(message: string): boolean {
  const lower = message.toLowerCase();
  return NEXT_REDACTED_MESSAGE_MARKERS.some((marker) => lower.includes(marker));
}

/**
 * Liefert eine für Nutzer anzeigbare Fehlermeldung. Fängt sowohl "kein Error-Objekt"
 * als auch "von Next.js in Production redigierte Nachricht" ab und fällt in beiden
 * Fällen auf `fallback` zurück, statt rohen/englischen Next-Text zu zeigen.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error) || !err.message.trim()) return fallback;
  if (isRedactedByNextjs(err.message)) return fallback;
  return err.message;
}
