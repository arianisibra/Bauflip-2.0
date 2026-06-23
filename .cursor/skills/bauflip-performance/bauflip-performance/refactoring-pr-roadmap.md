# Refactoring PR roadmap

Performance-related code cleanup after Hybrid-SSR and interaction fixes. **PR A–G implemented and user-verified locally** (`typecheck` + `build` green). Work may still be **uncommitted** — check `git status` before assuming deployed.

---

## PR summary

| PR | Risk | Status | Summary |
|----|------|--------|---------|
| **A** | Low | Done | Remove dead exports |
| **B** | Low | Done | Single `QueryHydrationBoundary` |
| **C** | Low | Done | Shared auth helpers |
| **D** | Low | Done | Order form field helper extracted |
| **E** | Medium | Done | Auftrag extras without full core |
| **F** | Medium | Done | Monteur mutations via hooks |
| **G** | Medium | Done | Scoped appointment invalidation |
| **H** | Medium (4/10) | Planned | Bootstrap + infinite page-1 dedupe |
| **I** | Medium | Shipped (code) | `project_core_bootstrap` + single sheet action — **await `db:push`** |

---

## PR-A — Dead code removal

**Removed exports (0 importers):**

| Symbol | File |
|--------|------|
| `getProjectSheetDataAction` | `app/(app)/projekte/actions.ts` |
| `fetchMonthTasksAction` | `app/(app)/kalender/actions.ts` |
| `fetchSessionProfileAction` | `app/(app)/layout-actions.ts` |
| `getProjectListMaxRows` | `lib/db/repository.ts` |

**Replaced by:** `getProjectSheetHeadAction` + `getProjectSheetDetailsAction` via `useProjectCore`; `fetchCalendarRangeTasksAction`; layout `SessionProfileProvider`.

**Verify:** `rg` zero hits; `npm run typecheck`; `npm run build`.

---

## PR-B — QueryHydrationBoundary

**Before:** 7 route-specific `*-hydration-boundary.tsx` files  
**After:** [`components/app/query-hydration-boundary.tsx`](../../../components/app/query-hydration-boundary.tsx)

**Pages updated:** projekte, kalender, mitarbeiter, tag, wochenplan, einstellungen, bestellformulare (and related).

**Verify:** Each route loads with dehydrated data; no hydration errors.

---

## PR-C — Auth helper deduplication

**New:**

- [`lib/auth/map-role.ts`](../../../lib/auth/map-role.ts) — `mapRole`
- [`lib/auth/cookies.ts`](../../../lib/auth/cookies.ts) — `hasSupabaseAuthCookie`

**Consumers:** `proxy.ts`, `lib/auth/session.ts`, `lib/supabase/server.ts`, `lib/auth/proxy-auth-headers.ts`, `lib/auth/user-metadata-keys.ts`

---

## PR-D — Order form fields

**New:** [`lib/order-forms/filled-fields.ts`](../../../lib/order-forms/filled-fields.ts) — `getFilledOrderFormFields`

**Consumers:** `projekt-sheet-editor.tsx`, `monteur-auftrag-client.tsx`

---

## PR-E — Auftrag extras slim

**New:**

- [`lib/auth/auftrag-access.ts`](../../../lib/auth/auftrag-access.ts) — `canAccessAuftragProject`
- `listProjectAttachmentsForProject` in repository

**Change:** `fetchAuftragExtrasAction` uses `getProjectCoreHead` + attachments list — not full `getProjectCore`.

**Page:** `canAccessAuftragProject` guard on auftrag page.

**HAR verify:** 1× extras POST on load, 0× core refetch.

**Security:** Server still verifies access — no shortcut.

---

## PR-F — Monteur hooks

**Change:** `monteur-auftrag-client.tsx` uses:

- `useUpdateAttachmentNotes`
- `useDeleteAttachment`
- `useSubmitTechnicianReport`

**Benefit:** Same `patchAttachment*` / `afterProjectCoreChange` as office path.

**HAR verify:** rapport + photos gate ≤ 4 POSTs.

---

## PR-G — Scoped calendar invalidation

**New/updated:** `invalidateAppointmentRangeCaches` in [`lib/query/invalidations.ts`](../../../lib/query/invalidations.ts)

**Wired in:** `useAddAppointment`, `useDeleteAppointment` with `appointmentWindow` from mutation context.

**Avoid:** `weekTasks.all()` + `availabilityRange.all()` when window known.

**Realtime:** `afterAppointmentChange` stays broad (no window in event).

---

## PR-I — `project_core_bootstrap` (Tier 1)

**Goal:** Sheet open: **1 POST** instead of head → details waterfall; **1 DB roundtrip** via RPC.

**New:**

| Piece | File |
|-------|------|
| Migration | `supabase/migrations/20260701120000_perf_project_core_bootstrap_rpc.sql` |
| Verify | `scripts/perf/verify-project-core-bootstrap-rpc.sql` |
| Loader | `loadProjectCoreBootstrap` in `lib/db/repository.ts` |
| Action | `getProjectSheetBootstrapAction` in `app/(app)/projekte/actions.ts` |
| Hook | `useProjectCore` → single `useQuery` on `projects.core` key |

**Keep:** `getProjectSheetHeadAction` / `getProjectSheetDetailsAction` as PostgREST fallback path.

**HAR verify:** 1× `core` POST; `slow_operation` `loadProjectCoreBootstrap` ≤ 600ms typical.

---

## PR-H — Planned

**Goal:** On `/projekte` filter change, dedupe `useProjekteBootstrap` + `useProjekteListInfinite` both fetching page 1.

**Risk:** Medium — SSR dehydrated state must stay in sync with client infinite query keys.

**Verify:** Filter change → ≤1 list POST; bootstrap meta still correct; HAR gate unchanged.

---

## Backlog (post PR-H)

| Item | Notes |
|------|-------|
| Partial `primeCore` everywhere | Audit mutations still invalidating broadly |
| Component splits | Large clients (`projekte-list-client`, calendars) |
| `availability_range_for_org` RPC | DB migration — user approval |

---

## Verification after every PR

```bash
npm run typecheck
npm run build
# Route-specific:
node scripts/perf/summarize-har.mjs <relevant.har>
```

---

## Phase 1 analysis (context)

Refactoring order came from read-only audit of 15 routes — identifying:

- Duplicate session fetches
- Duplicate hydration boundaries
- Auftrag extras over-fetch
- Monteur divergent mutation path
- Broad calendar invalidation

Full route table was in chat plan «Refactoring-Landkarte» — archived under `docs/archive/plans/` if moved.

---

## User verification log

| Milestone | Scope |
|-----------|-------|
| «alles funktioniert bis PR E» | A–E |
| Later confirmation | Through **PR-G** |

Proceed to PR-H only after explicit request — medium risk on filter/bootstrap sync.
