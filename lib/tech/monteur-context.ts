import type { ProjectStatus } from "@/lib/domain/types";

/** Montage / Nachtermin: kein neues Bestellformular am Rapport; gleiche Logik wie bisher + «bestellt». */
export function isMonteurMontageContext(status: ProjectStatus, priorReportCount: number): boolean {
  return (
    status === "montagebereit" ||
    status === "werkstatt" ||
    status === "bestellt" ||
    (status === "termin_geplant" && priorReportCount > 0)
  );
}
