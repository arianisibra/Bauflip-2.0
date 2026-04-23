/**
 * Central query-key factory. Never use string literals for query keys elsewhere —
 * always go through these helpers so keys stay consistent.
 *
 * Shape convention: ["domain", "scope", ...args] — wide-to-narrow, so `invalidateQueries`
 * can target broader prefixes (e.g. invalidate all project-scoped queries with
 * `{ queryKey: ["projects"] }`).
 */
export const queryKeys = {
  projects: {
    all: () => ["projects"] as const,
    list: () => ["projects", "list"] as const,
    core: (projectId: string) => ["projects", "core", projectId] as const,
  },
  weekTasks: {
    all: () => ["week-tasks"] as const,
    byDate: (isoDate: string) => ["week-tasks", isoDate] as const,
  },
  monthTasks: {
    all: () => ["month-tasks"] as const,
    byYearMonth: (year: number, month: number) => ["month-tasks", year, month] as const,
  },
  assignableProfiles: () => ["assignable-profiles"] as const,
  orderFormTemplates: {
    all: () => ["order-form-templates"] as const,
    byOrg: (orgId: string | null) => ["order-form-templates", orgId] as const,
  },
} as const;
