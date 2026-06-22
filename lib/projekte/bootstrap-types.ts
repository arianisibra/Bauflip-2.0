import type { OfficeProjectListItem, ProjectStatus } from "@/lib/domain/types";

export type OrganizationBrandingSnapshot = {
  name: string;
  logoUrl: string | null;
};

export type ProjekteBootstrapData = {
  projects: OfficeProjectListItem[];
  branding: OrganizationBrandingSnapshot;
};

export function projekteBootstrapStatusKey(status?: ProjectStatus): string {
  return status ?? "all";
}
