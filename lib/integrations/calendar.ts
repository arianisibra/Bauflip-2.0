export type CalendarInviteInput = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location?: string;
};

function toIcsDate(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildIcsInvite(input: CalendarInviteInput) {
  const uid = `${crypto.randomUUID()}@bauflip.ch`;
  const dtStamp = toIcsDate(new Date().toISOString());
  const dtStart = toIcsDate(input.startsAt);
  const dtEnd = toIcsDate(input.endsAt);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bauflip//Kalender//DE",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${input.title}`,
    `DESCRIPTION:${input.description}`,
    `LOCATION:${input.location ?? ""}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
