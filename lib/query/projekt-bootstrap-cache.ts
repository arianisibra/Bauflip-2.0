import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { ProjekteBootstrapData, ProjekteListPageSnapshot } from "@/lib/projekte/bootstrap-types";
import { queryKeys } from "@/lib/query/keys";

/** Shared stale window for SSR-dehydrated and client bootstrap queries. */
export const PROJEKTE_BOOTSTRAP_STALE_MS = 3 * 60 * 1000;

export type ProjekteListInfiniteData = InfiniteData<ProjekteListPageSnapshot, string | null>;

export function primeProjekteBootstrapCache(
  queryClient: QueryClient,
  statusKey: string,
  searchKey: string,
  data: ProjekteBootstrapData,
): void {
  const meta = {
    branding: data.branding,
    statusCounts: data.statusCounts,
    listMeta: data.listMeta,
  };
  queryClient.setQueryData(queryKeys.projekteBootstrap(statusKey, searchKey), meta);
  queryClient.setQueryData<ProjekteListInfiniteData>(queryKeys.projekteList(statusKey, searchKey), {
    pages: [
      {
        projects: data.projects,
        nextCursor: data.nextCursor,
        hasMore: data.hasMore,
      },
    ],
    pageParams: [null],
  });
  queryClient.setQueryData(queryKeys.projects.list(), data.projects);
  queryClient.setQueryData(queryKeys.organizationBranding(), data.branding);
}

export function primeProjekteListPageCache(
  queryClient: QueryClient,
  statusKey: string,
  searchKey: string,
  data: ProjekteBootstrapData,
): void {
  primeProjekteBootstrapCache(queryClient, statusKey, searchKey, data);
}
