/**
 * Wer darf eine neue Firma anlegen?
 *
 * Bauflip wird persönlich vertrieben — Kunden werden begleitet eingerichtet,
 * nicht per Selbstbedienung. Eine offene Registrierung nützt deshalb niemandem
 * und schafft nur Angriffsfläche: fremde Konten, belegter Speicher, versendete
 * Bestätigungsmails auf Kosten des Betreibers.
 *
 * Captcha und Rate-Limit bremsen Massenanlagen, aber sie beantworten nicht die
 * eigentliche Frage: SOLL dieser Mensch überhaupt eine Firma anlegen dürfen?
 * Genau das regelt dieser Schalter.
 *
 *   closed  Standard. /registrieren ist zu; neue Firmen legt der Betreiber an.
 *   code    Nur mit Einladungscode (REGISTRATION_CODE).
 *   open    Wie bisher — jeder darf.
 *
 * Der Standard ist bewusst `closed`: Fehlt die Variable oder ist sie
 * verschrieben, ist die Registrierung ZU statt offen. Eine falsch geschriebene
 * Umgebungsvariable darf kein Scheunentor aufmachen.
 */
export type RegistrationMode = "closed" | "code" | "open";

export function resolveRegistrationMode(
  raw = process.env.REGISTRATION_MODE,
): RegistrationMode {
  const wert = raw?.trim().toLowerCase();
  if (wert === "open") return "open";
  if (wert === "code") return "code";
  return "closed";
}

export type RegistrationCheck = { ok: true } | { ok: false; error: string };

/**
 * Darf registriert werden? Wird SERVERSEITIG in der Aktion geprüft, nicht nur
 * beim Anzeigen der Seite: Server Actions sind öffentliche HTTP-Endpunkte und
 * lassen sich ohne die Seite aufrufen.
 */
export function checkRegistrationAllowed(
  vorgelegterCode: string | null | undefined,
  mode = resolveRegistrationMode(),
  erwarteterCode = process.env.REGISTRATION_CODE,
): RegistrationCheck {
  if (mode === "open") return { ok: true };

  if (mode === "closed") {
    return {
      ok: false,
      error: "Die Registrierung ist geschlossen. Bitte wenden Sie sich an Ihren Ansprechpartner.",
    };
  }

  // mode === "code"
  const erwartet = erwarteterCode?.trim();
  if (!erwartet) {
    // Modus verlangt einen Code, aber es ist keiner hinterlegt — dann zu.
    return {
      ok: false,
      error: "Die Registrierung ist geschlossen. Bitte wenden Sie sich an Ihren Ansprechpartner.",
    };
  }
  const vorgelegt = vorgelegterCode?.trim();
  if (!vorgelegt || vorgelegt !== erwartet) {
    return { ok: false, error: "Der Einladungscode stimmt nicht." };
  }
  return { ok: true };
}
