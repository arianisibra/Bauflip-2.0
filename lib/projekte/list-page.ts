import type { OfficeProjectListItem } from "@/lib/domain/types";

/** Initial and subsequent page size for office project list. */
export const PROJEKTE_LIST_PAGE_SIZE = 50;

/** Minimum characters before server search runs. */
export const PROJEKTE_SEARCH_MIN_CHARS = 2;

/** Cap for abgemacht full-fetch before offset paging. */
export const PROJEKTE_ABGEMACHT_MAX_ROWS = 500;

export type ProjekteListKeysetCursor = {
  kind: "keyset";
  /** For filter «all»: open projects first, then abgeschlossen. */
  segment?: "open" | "closed";
  createdAt?: string;
  id?: string;
};

export type ProjekteListOffsetCursor = {
  kind: "offset";
  offset: number;
};

export type ProjekteListCursor = ProjekteListKeysetCursor | ProjekteListOffsetCursor;

export type ProjekteListPageResult = {
  projects: OfficeProjectListItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

export function normalizeSearchQuery(raw: string | null | undefined): string {
  return raw?.trim() ?? "";
}

/** Returns normalized query when long enough for server search, else empty string. */
export function parseProjekteSearchQuery(raw: string | null | undefined): string {
  const normalized = normalizeSearchQuery(raw);
  if (normalized.length < PROJEKTE_SEARCH_MIN_CHARS) {
    return "";
  }
  return normalized;
}

export function encodeProjekteListCursor(cursor: ProjekteListCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeProjekteListCursor(raw: string | null | undefined): ProjekteListCursor | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as ProjekteListCursor;
    if (parsed.kind === "keyset") {
      if (parsed.segment === "closed" && !parsed.createdAt) {
        return parsed;
      }
      if (parsed.createdAt && parsed.id) {
        return parsed;
      }
      if (!parsed.segment || parsed.segment === "open") {
        return parsed;
      }
    }
    if (parsed.kind === "offset" && typeof parsed.offset === "number" && parsed.offset >= 0) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function projekteListSearchKey(searchQuery: string): string {
  return parseProjekteSearchQuery(searchQuery);
}
