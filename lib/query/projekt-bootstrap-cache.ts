import type { QueryClient } from "@tanstack/react-query";
import type { ProjekteBootstrapData } from "@/lib/projekte/bootstrap-types";
import { queryKeys } from "@/lib/query/keys";

/** Shared stale window for SSR-dehydrated and client bootstrap queries. */
export const PROJEKTE_BOOTSTRAP_STALE_MS = 3 * 60 * 1000;

export function primeProjekteBootstrapCache(
  queryClient: QueryClient,
  statusKey: string,
  data: ProjekteBootstrapData,
): void {
  queryClient.setQueryData(queryKeys.projekteBootstrap(statusKey), data);
  queryClient.setQueryData(queryKeys.projects.list(), data.projects);
  queryClient.setQueryData(queryKeys.organizationBranding(), data.branding);
}
