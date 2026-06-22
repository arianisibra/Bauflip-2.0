import type { OfficeProjectListItem } from "@/lib/domain/types";

/** Nächster Termin zuerst; ohne Termin ans Ende; dann created_at desc, Titel. */
export function compareAbgemachtListOrder(a: OfficeProjectListItem, b: OfficeProjectListItem): number {
  const ta = a.nextAppointmentStartsAt;
  const tb = b.nextAppointmentStartsAt;
  if (ta && tb) {
    const byAppt = ta.localeCompare(tb);
    if (byAppt !== 0) return byAppt;
  } else if (ta && !tb) return -1;
  else if (!ta && tb) return 1;

  const byCreated = b.createdAt.localeCompare(a.createdAt);
  if (byCreated !== 0) return byCreated;

  return a.title.localeCompare(b.title, "de", { sensitivity: "base" });
}

export function sortAbgemachtOfficeProjects(items: OfficeProjectListItem[]): OfficeProjectListItem[] {
  return [...items].sort(compareAbgemachtListOrder);
}
