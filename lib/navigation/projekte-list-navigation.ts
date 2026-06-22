import type { ReadonlyURLSearchParams } from "next/navigation";
import {
  DEFAULT_PROJEKTE_LIST_FILTER,
  parseProjekteListFilter,
  type ProjekteListFilter,
} from "@/lib/projekte/list-filter";

export function parseProjekteListUrlFilter(
  searchParams: Pick<ReadonlyURLSearchParams, "get">,
): ProjekteListFilter {
  return parseProjekteListFilter(searchParams.get("status"));
}

export function buildProjekteListSearchParams(
  listFilter: ProjekteListFilter,
  preserve?: URLSearchParams | ReadonlyURLSearchParams,
): URLSearchParams {
  const params = new URLSearchParams(preserve?.toString() ?? "");
  if (listFilter === DEFAULT_PROJEKTE_LIST_FILTER) {
    params.delete("status");
  } else {
    params.set("status", listFilter);
  }
  return params;
}

export function buildProjekteListHref(
  listFilter: ProjekteListFilter,
  preserve?: URLSearchParams | ReadonlyURLSearchParams,
): string {
  const qs = buildProjekteListSearchParams(listFilter, preserve).toString();
  return qs ? `/projekte?${qs}` : "/projekte";
}

export function projekteListQueriesEqual(currentQs: string, builtHref: string): boolean {
  const builtQs = builtHref.includes("?") ? builtHref.split("?")[1] ?? "" : "";
  const a = new URLSearchParams(currentQs);
  const b = new URLSearchParams(builtQs);
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const k of keys) {
    if (a.get(k) !== b.get(k)) return false;
  }
  return true;
}
