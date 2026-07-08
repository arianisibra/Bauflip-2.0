/**
 * iCalendar-Einladungen (RFC 5545) für Termin-Mails — pure functions.
 *
 * METHOD:REQUEST bucht den Termin in Outlook/Google/Apple direkt ein
 * (erscheint als Einladung mit Annehmen/Ablehnen); METHOD:CANCEL trägt aus.
 * Updates nutzen dieselbe UID mit höherer SEQUENCE — wir verwenden den
 * Versand-Unix-Timestamp (streng steigend, keine DB-Zähllogik nötig).
 */

export type CalendarInviteEvent = {
  /** Stabil pro Termin (appointments.id) — Grundlage für Update/Cancel-Matching. */
  uid: string;
  /** Streng steigend pro UID; Empfehlung: Unix-Sekunden des Versands. */
  sequence: number;
  /** ISO-Instants (UTC-Serialisierung im ICS; Clients zeigen lokal an). */
  startsAtIso: string;
  endsAtIso: string;
  summary: string;
  description: string | null;
  location: string | null;
  organizer: { name: string; email: string };
  attendeeEmail: string;
};

/** 2026-07-07T10:00:00.000Z → 20260707T100000Z */
function icsUtcStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Ungültiges Datum für ICS: ${iso}`);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** RFC-5545-Escaping für Textwerte: Backslash, Semikolon, Komma, Zeilenumbruch. */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Zeilen länger als 75 Oktette falten (CRLF + Leerzeichen), UTF-8-sicher. */
function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    const candidate = current + char;
    // 74 als Budget für Folgezeilen (führendes Leerzeichen zählt mit).
    if (encoder.encode(candidate).length > 74 && current) {
      parts.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  if (current) parts.push(current);
  return parts.map((p, i) => (i === 0 ? p : ` ${p}`)).join("\r\n");
}

function buildIcs(method: "REQUEST" | "CANCEL", event: CalendarInviteEvent): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "PRODID:-//Bauflip//Termin//DE",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(event.uid)}`,
    `SEQUENCE:${event.sequence}`,
    `DTSTAMP:${icsUtcStamp(new Date().toISOString())}`,
    `DTSTART:${icsUtcStamp(event.startsAtIso)}`,
    `DTEND:${icsUtcStamp(event.endsAtIso)}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
  ];
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  lines.push(
    `ORGANIZER;CN=${escapeIcsText(event.organizer.name)}:mailto:${event.organizer.email}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${event.attendeeEmail}`,
  );
  if (method === "CANCEL") lines.push("STATUS:CANCELLED");
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

export function buildInviteRequest(event: CalendarInviteEvent): string {
  return buildIcs("REQUEST", event);
}

export function buildInviteCancel(event: CalendarInviteEvent): string {
  return buildIcs("CANCEL", event);
}
