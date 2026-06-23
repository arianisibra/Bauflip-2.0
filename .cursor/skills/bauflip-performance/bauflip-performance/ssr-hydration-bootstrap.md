# Hybrid SSR and hydration bootstrap

## Pattern

```
page.tsx (RSC)
  → load*BootstrapData(orgId, …)
  → build*DehydratedState()  // TanStack dehydrate
  → <QueryHydrationBoundary state={…}>
  → Client component + useQuery hooks (same query keys)
```

Shared boundary (PR-B): [`components/app/query-hydration-boundary.tsx`](../../../components/app/query-hydration-boundary.tsx)

`export const dynamic = "force-dynamic"` on bootstrap routes is acceptable — personalized data requires dynamic render anyway.

---

## Per-route bootstrap map

| Route | Server bootstrap | Client hooks | RPC / heavy read |
|-------|------------------|--------------|------------------|
| `/projekte` | [`lib/projekte/server-bootstrap.ts`](../../../lib/projekte/server-bootstrap.ts) | `useProjekteBootstrap`, `useProjekteListInfinite` | `projekte_office_bootstrap` (+ fallback) |
| `/kalender` | [`lib/kalender/server-bootstrap.ts`](../../../lib/kalender/server-bootstrap.ts) | week/range tasks hooks | `calendar_range_tasks_for_org` |
| `/mitarbeiter` | [`lib/mitarbeiter/server-bootstrap.ts`](../../../lib/mitarbeiter/server-bootstrap.ts) | team, absences | `mitarbeiter_office_bootstrap` |
| `/tag` | [`lib/tag/server-bootstrap.ts`](../../../lib/tag/server-bootstrap.ts) | `useWeekTasks` | calendar RPC (shared week key) |
| `/wochenplan` | [`lib/tech/server-bootstrap.ts`](../../../lib/tech/server-bootstrap.ts) | week + optional month | calendar RPC; month defer |
| `/einstellungen` | [`lib/einstellungen/server-bootstrap.ts`](../../../lib/einstellungen/server-bootstrap.ts) | settings hooks | profile + org |
| `/bestellformulare` | [`lib/bestellformulare/server-bootstrap.ts`](../../../lib/bestellformulare/server-bootstrap.ts) | templates query | template list |
| `/auftrag/[id]` | inline in page | `useAuftragProjectCore`, extras query | SSR `getProjectCore` only |

---

## Query key rules

- Keys in [`lib/query/keys.ts`](../../../lib/query/keys.ts)
- Swiss week boundaries: [`lib/date/swiss-week.ts`](../../../lib/date/swiss-week.ts)
- **Calendar range keys must match server and client** — Europe/Zurich wall-clock, not raw UTC ISO mismatch

### Kalender hydration fix (critical)

**Problem:** Netlify (UTC) dehydrated `2026-06-22T00:00:00.000Z` while browser (Zurich) queried `2026-06-21T22:00:00.000Z` → cache miss → redundant ~800ms POST.

**Fix:** Shared bounds helper (e.g. `lib/query/calendar-range-bounds.ts` or swiss-week utilities) used in both server bootstrap and client `useQuery`.

---

## `/projekte` specifics

| Concern | Implementation |
|---------|----------------|
| Default filter | `active` (excludes `abgeschlossen`) |
| URL state | `?status=`, `?q=` (min 2 chars), `?openProjectId=` |
| Pagination | SSR seeds page 1 (50 rows); «Weitere laden» via infinite query |
| Status counts | In bootstrap meta; RPC `project_status_counts_for_org` or combined in `projekte_office_bootstrap` |
| Next appointment RPC | Only when `?status=abgemacht` |
| Branding | App layout SSR/context (Phase 2e) — not in projekte bootstrap |
| Assignable profiles | **Lazy** on sheet open (`listAssignableProfilesAction`) |
| Deep link page 2+ | `fetchOfficeProjectListItemAction` fallback |

Dehydration must not duplicate `projects.list` + meta queries (Phase 2d).

---

## `/kalender` specifics

| Concern | Implementation |
|---------|----------------|
| SSR range | Appointments in RSC payload |
| Sheet URL | `kalender-sheet-context.tsx` — `replaceState`, not `router.replace` |
| Day/view URL | `admin-calendar.tsx` — `replaceState` |
| Lazy sheet JS | `dynamic()` for `ProjektSheetEditor` in `kalender-project-sheet.tsx` |
| `useProjectCore` | `refetchOnMount: false` after hover prefetch |
| Sidebar prefetch | `prefetch={false}` |

---

## `/auftrag` defer pattern

1. **SSR:** `getProjectCore` + access guard (`canAccessAuftragProject` — PR-E)
2. **Client:** `fetchAuftragExtrasAction` — signed URLs + order form templates
3. **`useAuftragProjectCore`:** `initialData` from SSR + `refetchOnMount: false`
4. **PR-E extras:** `getProjectCoreHead` + `listProjectAttachmentsForProject` only — no full core reload

---

## `/wochenplan` month defer

| URL | SSR | Client POST |
|-----|-----|-------------|
| Default (day/week) | Week tasks | 0× on load |
| `?view=month` | Week + month | 0× month on load |
| Switch to month tab without URL | — | 1× month (expected) |
| Change month arrows | — | 1× per new month |

Shared `weekTasks.byDate(refIso)` with `/tag` — same week benefits from either route's SSR.

---

## Security

- `organizationId` from `getLayoutSession()` in page RSC
- `load*BootstrapData(orgId)` always passes explicit org — RLS unchanged
- Never dehydrate cross-org data; bootstrap loaders org-scoped

---

## When Hybrid-SSR is not worth it

Preview HAR decision (from performance doc):

| Warm data ready | Action |
|-----------------|--------|
| ≤ 1.5 s, 1 POST | Hybrid-SSR optional |
| Hydration gap > 500ms dominates | Evaluate SSR bootstrap |
| Cold start Netlify-only | Observe; no architecture rewrite |

Current Bauflip state: Hybrid-SSR **shipped** on main office/tech list routes.

---

## PR-B migration note

Seven route-specific `*-hydration-boundary.tsx` files were replaced by one `QueryHydrationBoundary`. Pages pass `dehydratedState` from their `build*DehydratedState` helper.
