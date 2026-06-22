import "server-only";

import { getOrganizationBranding, listProjectsForOffice } from "@/lib/db/repository";
import type { ProjectStatus } from "@/lib/domain/types";
import {
  type ProjekteBootstrapData,
  projekteBootstrapStatusKey,
} from "@/lib/projekte/bootstrap-types";
import { PROJEKTE_BOOTSTRAP_STALE_MS, primeProjekteBootstrapCache } from "@/lib/query/projekt-bootstrap-cache";
import { dehydrate, QueryClient } from "@tanstack/react-query";

/**
 * Loads office project list + branding for the authenticated user's organization only.
 * RLS + explicit organization_id filter — never cross-tenant.
 */
export async function loadProjekteBootstrapData(
  organizationId: string,
  status?: ProjectStatus,
): Promise<ProjekteBootstrapData> {
  const [projects, branding] = await Promise.all([
    listProjectsForOffice(organizationId, status),
    getOrganizationBranding(organizationId),
  ]);
  return { projects, branding };
}

export async function buildProjekteDehydratedState(
  organizationId: string,
  status?: ProjectStatus,
): Promise<ReturnType<typeof dehydrate>> {
  const statusKey = projekteBootstrapStatusKey(status);
  const data = await loadProjekteBootstrapData(organizationId, status);

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
