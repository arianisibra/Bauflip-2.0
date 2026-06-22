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

export type ProjekteBootstrapData = {
  projects: OfficeProjectListItem[];
  branding: OrganizationBrandingSnapshot;
  statusCounts: ProjekteStatusCountsSnapshot;
  /** Server-side observability for perf docs — not used in UI. */
  listMeta: {
    listFilter: ProjekteListFilter;
    projectCount: number;
    rpc: "skipped" | "next_appointment_starts_for_org";
  };
};

export { listFilterBootstrapKey as projekteBootstrapStatusKey };
