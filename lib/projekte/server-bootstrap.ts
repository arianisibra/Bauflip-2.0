import "server-only";

import {
  getOrganizationBranding,
  listProjectStatusCountsForOffice,
  listProjectsForOffice,
} from "@/lib/db/repository";
import {
  type ProjekteBootstrapData,
  projekteBootstrapStatusKey,
} from "@/lib/projekte/bootstrap-types";
import {
  DEFAULT_PROJEKTE_LIST_FILTER,
  needsNextAppointmentRpc,
  type ProjekteListFilter,
} from "@/lib/projekte/list-filter";
import { PROJEKTE_BOOTSTRAP_STALE_MS, primeProjekteBootstrapCache } from "@/lib/query/projekt-bootstrap-cache";
import { dehydrate, QueryClient } from "@tanstack/react-query";

/**
 * Loads office project list + branding for the authenticated user's organization only.
 * RLS + explicit organization_id filter — never cross-tenant.
 */
export async function loadProjekteBootstrapData(
  organizationId: string,
  listFilter: ProjekteListFilter = DEFAULT_PROJEKTE_LIST_FILTER,
): Promise<ProjekteBootstrapData> {
  const [projects, branding, statusCounts] = await Promise.all([
    listProjectsForOffice(organizationId, listFilter),
    getOrganizationBranding(organizationId),
    listProjectStatusCountsForOffice(organizationId),
  ]);
  return {
    projects,
    branding,
    statusCounts,
    listMeta: {
      listFilter,
      projectCount: projects.length,
      rpc: needsNextAppointmentRpc(listFilter)
        ? "next_appointment_starts_for_org"
        : "skipped",
    },
  };
}

export async function buildProjekteDehydratedState(
  organizationId: string,
  listFilter: ProjekteListFilter = DEFAULT_PROJEKTE_LIST_FILTER,
): Promise<ReturnType<typeof dehydrate>> {
  const statusKey = projekteBootstrapStatusKey(listFilter);
  const data = await loadProjekteBootstrapData(organizationId, listFilter);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: PROJEKTE_BOOTSTRAP_STALE_MS,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  primeProjekteBootstrapCache(queryClient, statusKey, data);
  return dehydrate(queryClient);
}
