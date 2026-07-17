import { projectStatuses, type ProjectStatus } from "@/lib/domain/types";

/** Büro-Listenfilter: Default «active» schliesst abgeschlossen aus; «archived» zeigt nur archivierte. */
export type ProjekteListFilter = "active" | "all" | "archived" | ProjectStatus;

export const DEFAULT_PROJEKTE_LIST_FILTER: ProjekteListFilter = "active";

const PROJECT_STATUS_SET = new Set<string>(projectStatuses);

export function isProjectStatus(value: string): value is ProjectStatus {
  return PROJECT_STATUS_SET.has(value);
}

export function parseProjekteListFilter(raw: string | null | undefined): ProjekteListFilter {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_PROJEKTE_LIST_FILTER;
  if (trimmed === "active" || trimmed === "all" || trimmed === "archived") return trimmed;
  if (isProjectStatus(trimmed)) return trimmed;
  return DEFAULT_PROJEKTE_LIST_FILTER;
}

export function projekteBootstrapStatusKey(filter: ProjekteListFilter = DEFAULT_PROJEKTE_LIST_FILTER): string {
  return filter;
}

/** Termin-RPC nur für Filter «ABGEMACHT» (Termin-Sortierung). */
export function needsNextAppointmentRpc(filter: ProjekteListFilter): boolean {
  return filter === "abgemacht";
}

export function matchesProjekteListFilter(status: ProjectStatus, filter: ProjekteListFilter): boolean {
  if (filter === "all") return true;
  // «archived» wird serverseitig über archived_at gefiltert (Status ist beliebig) —
  // geladene Zeilen sind bereits alle archiviert, daher hier immer true.
  if (filter === "archived") return true;
  if (filter === "active") return status !== "abgeschlossen";
  return status === filter;
}

export function totalProjectsForListFilter(
  counts: {
    byStatus: Partial<Record<ProjectStatus, number>>;
    totalAll: number;
    totalActive: number;
    totalArchived?: number;
  },
  filter: ProjekteListFilter,
): number {
  if (filter === "all") return counts.totalAll;
  if (filter === "active") return counts.totalActive;
  if (filter === "archived") return counts.totalArchived ?? 0;
  if (isProjectStatus(filter)) return counts.byStatus[filter] ?? 0;
  return counts.totalActive;
}
