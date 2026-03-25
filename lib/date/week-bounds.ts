/** Monday 00:00:00 – Sunday 23:59:59.999 in local time (Schweiz-typische Wochenlogik). */
export function getWeekBounds(reference = new Date()): { start: Date; end: Date } {
  const date = new Date(reference);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

export function formatWeekRangeDe(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat("de-CH", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}
