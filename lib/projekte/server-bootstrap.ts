import "server-only";

import {
  getOrganizationBranding,
  listProjectStatusCountsForOffice,
  listProjectsForOfficePage,
} from "@/lib/db/repository";
import {
  type ProjekteBootstrapData,
  projekteBootstrapStatusKey,
} from "@/lib/projekte/bootstrap-types";
import {
  DEFAULT_PROJEKTE_LIST_FILTER,
  needsNextAppointmentRpc,
  totalProjectsForListFilter,
  type ProjekteListFilter,
} from "@/lib/projekte/list-filter";
import { parseProjekteSearchQuery, PROJEKTE_LIST_PAGE_SIZE } from "@/lib/projekte/list-page";
import { PROJEKTE_BOOTSTRAP_STALE_MS, primeProjekteBootstrapCache } from "@/lib/query/projekt-bootstrap-cache";
import { dehydrate, QueryClient } from "@tanstack/react-query";

/**
 * Loads office project list page 1 + branding + counts for the authenticated user's organization only.
 * RLS + explicit organization_id filter — never cross-tenant.
 */
export async function loadProjekteBootstrapData(
  organizationId: string,
  listFilter: ProjekteListFilter = DEFAULT_PROJEKTE_LIST_FILTER,
  searchQueryRaw?: string | null,
): Promise<ProjekteBootstrapData> {
  const searchQuery = parseProjekteSearchQuery(searchQueryRaw);
  const [page, branding, statusCounts] = await Promise.all([
    listProjectsForOfficePage(organizationId, listFilter, { searchQuery }),
    getOrganizationBranding(organizationId),
    listProjectStatusCountsForOffice(organizationId),
  ]);
  const totalForFilter = searchQuery
    ? page.projects.length + (page.hasMore ? 1 : 0)
    : totalProjectsForListFilter(statusCounts, listFilter);

  return {
    projects: page.projects,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    branding,
    statusCounts,
    listMeta: {
      listFilter,
      searchQuery,
      pageSize: PROJEKTE_LIST_PAGE_SIZE,
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
      totalForFilter,
      rpc: needsNextAppointmentRpc(listFilter)
        ? "next_appointment_starts_for_org"
        : "skipped",
    },
  };
}

export async function buildProjekteDehydratedState(
  organizationId: string,
  listFilter: ProjekteListFilter = DEFAULT_PROJEKTE_LIST_FILTER,
  searchQueryRaw?: string | null,
): Promise<ReturnType<typeof dehydrate>> {
  const statusKey = projekteBootstrapStatusKey(listFilter);
  const searchKey = parseProjekteSearchQuery(searchQueryRaw);
  const data = await loadProjekteBootstrapData(organizationId, listFilter, searchQueryRaw);

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

  primeProjekteBootstrapCache(queryClient, statusKey, searchKey, data);
  return dehydrate(queryClient);
}
