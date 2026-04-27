import type { WeekTaskItem } from "@/lib/domain/types";

const TZ = "Europe/Zurich";

/** YYYY-MM-DD in Europe/Zurich for an ISO instant. */
export function swissDayKeyFromTaskStart(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
}

export type WeekTaskProjectDayGroup = {
  /** `projectId` + Swiss day — stable React key. */
  key: string;
  projectId: string;
  dayKey: string;
  /** Chronologisch nach `startsAt`. */
  slots: WeekTaskItem[];
  /** Erster Slot (Metadaten: Titel, Farbe, …). */
  primary: WeekTaskItem;
};

/**
 * Mehrere Termine desselben Projekts am selben Kalendertag → eine Gruppe
 * (ein Kalendereintrag für den Monteur).
 */
export function groupWeekTasksByProjectDay(tasks: WeekTaskItem[]): WeekTaskProjectDayGroup[] {
  const map = new Map<string, WeekTaskItem[]>();
  for (const t of tasks) {
    const dayKey = swissDayKeyFromTaskStart(t.startsAt);
    const gk = `${t.projectId}__${dayKey}`;
    const list = map.get(gk) ?? [];
    list.push(t);
    map.set(gk, list);
  }
  const out: WeekTaskProjectDayGroup[] = [];
  for (const [compoundKey, slots] of map) {
    slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const sep = compoundKey.indexOf("__");
    const projectId = sep >= 0 ? compoundKey.slice(0, sep) : compoundKey;
    const dayKey = sep >= 0 ? compoundKey.slice(sep + 2) : "";
    const primary = slots[0]!;
    out.push({
      key: compoundKey,
      projectId,
      dayKey,
      slots,
      primary,
    });
  }
  out.sort((a, b) => a.primary.startsAt.localeCompare(b.primary.startsAt));
  return out;
}
