import type { OfficeProjectListItem, ProjectStatus } from "@/lib/domain/types";
import type { ProjekteListFilter } from "@/lib/projekte/list-filter";
import { projekteBootstrapStatusKey as listFilterBootstrapKey } from "@/lib/projekte/list-filter";

export type OrganizationBrandingSnapshot = {
  name: string;
  logoUrl: string | null;
};

export type ProjekteStatusCountsSnapshot = {
  byStatus: Partial<Record<ProjectStatus, number>>;
  totalAll: number;
  totalActive: number;
};

export type ProjekteListPageSnapshot = {
  projects: OfficeProjectListItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type ProjekteBootstrapData = {
  /** First page only — use infinite query for additional pages. */
  projects: OfficeProjectListItem[];
  statusCounts: ProjekteStatusCountsSnapshot;
  nextCursor: string | null;
  hasMore: boolean;
  /** Server-side observability for perf docs — not used in UI. */
  listMeta: {
    listFilter: ProjekteListFilter;
    searchQuery: string;
    pageSize: number;
    hasMore: boolean;
    nextCursor: string | null;
    totalForFilter: number;
    rpc: "skipped" | "next_appointment_starts_for_org" | "projekte_office_bootstrap";
  };
};

export { listFilterBootstrapKey as projekteBootstrapStatusKey };
