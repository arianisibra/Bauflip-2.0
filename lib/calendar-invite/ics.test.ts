import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInviteCancel,
  buildInviteRequest,
  type CalendarInviteEvent,
} from "@/lib/calendar-invite/ics";

function sampleEvent(overrides: Partial<CalendarInviteEvent> = {}): CalendarInviteEvent {
  return {
    uid: "appt-123@bauflip",
    sequence: 1751900000,
    startsAtIso: "2026-07-13T06:00:00.000Z",
    endsAtIso: "2026-07-13T08:30:00.000Z",
    summary: "Besichtigung: Storen-Reparatur",
    description: "Projekt 2026-1042\nMieter: Familie Muster",
    location: "Musterstrasse 12, 8004 Zürich",
    organizer: { name: "Bauflip Storen AG", email: "termine@bauflip.ch" },
    attendeeEmail: "monteur@example.com",
    ...overrides,
  };
}

/** Gefaltete Zeilen wieder zusammensetzen (CRLF + Space = Fortsetzung). */
function unfold(ics: string): string[] {
  return ics.replace(/\r\n[ ]/g, "").split("\r\n").filter(Boolean);
}

describe("buildInviteRequest", () => {
  it("produces a METHOD:REQUEST VCALENDAR with the core fields", () => {
    const lines = unfold(buildInviteRequest(sampleEvent()));
    assert.equal(lines[0], "BEGIN:VCALENDAR");
    assert.ok(lines.includes("METHOD:REQUEST"));
    assert.ok(lines.includes("UID:appt-123@bauflip"));
    assert.ok(lines.includes("SEQUENCE:1751900000"));
    assert.ok(lines.includes("DTSTART:20260713T060000Z"));
    assert.ok(lines.includes("DTEND:20260713T083000Z"));
    assert.ok(lines.includes("ORGANIZER;CN=Bauflip Storen AG:mailto:termine@bauflip.ch"));
    assert.ok(
      lines.includes(
        "ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:monteur@example.com",
      ),
    );
    assert.equal(lines[lines.length - 1], "END:VCALENDAR");
    assert.ok(!lines.includes("STATUS:CANCELLED"));
  });

  it("escapes commas, semicolons and newlines in text values", () => {
    const lines = unfold(
      buildInviteRequest(
        sampleEvent({ summary: "A;B,C", description: "Zeile 1\nZeile 2", location: null }),
      ),
    );
    assert.ok(lines.includes("SUMMARY:A\\;B\\,C"));
    assert.ok(lines.includes("DESCRIPTION:Zeile 1\\nZeile 2"));
    assert.ok(!lines.some((l) => l.startsWith("LOCATION")));
  });

  it("folds long lines to <= 75 octets", () => {
    const ics = buildInviteRequest(sampleEvent({ description: "X".repeat(300) }));
    const encoder = new TextEncoder();
    for (const rawLine of ics.split("\r\n")) {
      assert.ok(encoder.encode(rawLine).length <= 75, `line too long: ${rawLine.length}`);
    }
    // Inhalt bleibt nach Unfolding vollständig erhalten.
    assert.ok(unfold(ics).some((l) => l === `DESCRIPTION:${"X".repeat(300)}`));
  });

  it("folds UTF-8 safely (umlauts are multi-byte)", () => {
    const ics = buildInviteRequest(sampleEvent({ description: "ü".repeat(200) }));
    const encoder = new TextEncoder();
    for (const rawLine of ics.split("\r\n")) {
      assert.ok(encoder.encode(rawLine).length <= 75);
    }
    assert.ok(unfold(ics).some((l) => l === `DESCRIPTION:${"ü".repeat(200)}`));
  });

  it("throws on invalid dates", () => {
    assert.throws(() => buildInviteRequest(sampleEvent({ startsAtIso: "kaputt" })));
  });
});

describe("buildInviteCancel", () => {
  it("produces METHOD:CANCEL with STATUS:CANCELLED and the same UID", () => {
    const lines = unfold(buildInviteCancel(sampleEvent({ sequence: 1751900999 })));
    assert.ok(lines.includes("METHOD:CANCEL"));
    assert.ok(lines.includes("STATUS:CANCELLED"));
    assert.ok(lines.includes("UID:appt-123@bauflip"));
    assert.ok(lines.includes("SEQUENCE:1751900999"));
  });
});
