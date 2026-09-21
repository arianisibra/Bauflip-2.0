/**
 * Fachliche, für den Nutzer bestimmte Fehler — und wie sie den Browser erreichen.
 *
 * Next.js schwärzt in Produktion die Meldung JEDER geworfenen Server-Action-Exception
 * («An error occurred in the Server Components render …»). Der deutsche Satz existiert im
 * Browser dann nicht mehr; kein Filter auf der Client-Seite kann ihn zurückholen.
 * Die Next-Doku im Projekt (01-getting-started/10-error-handling.md) verlangt deshalb:
 * «model expected errors as return values».
 *
 * Belegt am 21.09.2026 beim Kunden: «Diese Person ist in diesem Zeitraum in den Ferien.» (7×)
 * und «Unbekanntes Feld „position“ für Vorlage.» (7×) standen nur im Server-Log — der Kunde sah
 * beide Male denselben englischen Platzhalter und konnte nicht wissen, was zu tun ist.
 *
 * Muster:
 *   Server:  throw new FachFehler("…")            irgendwo in der Tiefe
 *            catch (e) { const f = alsAktionsFehler(e); if (f) return f; throw e; }
 *   Client:  mutationFn: async (v) => entpacken(await aktion(v))
 *
 * Nur ERWARTBARE Fehler (Validierung, Ferien, Doppelbelegung) sind Fachfehler. Alles andere
 * bleibt eine Exception — deren Text soll gar nicht beim Nutzer landen.
 */
export class FachFehler extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FachFehler";
  }
}

export type AktionsFehler = { ok: false; error: string };

export function alsAktionsFehler(e: unknown): AktionsFehler | null {
  return e instanceof FachFehler ? { ok: false, error: e.message } : null;
}

function istAktionsFehler(res: unknown): res is AktionsFehler {
  return (
    typeof res === "object" &&
    res !== null &&
    (res as { ok?: unknown }).ok === false &&
    typeof (res as { error?: unknown }).error === "string"
  );
}

/** Client-Seite: macht aus dem Rückgabewert wieder einen Fehler — im Browser geworfen, also ungeschwärzt. */
export function entpacken<T>(res: T | AktionsFehler): T {
  if (istAktionsFehler(res)) {
    throw new Error(res.error);
  }
  return res;
}
