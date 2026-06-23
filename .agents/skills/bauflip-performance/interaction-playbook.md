# Interaction playbook

Problem → HAR symptom → fix → files. For gates see [har-measurement.md](./har-measurement.md).

---

## Availability storm (Termin buchen)

| | |
|---|---|
| **Problem** | Each date/kind/technician change fired immediate availability fetch |
| **HAR** | ~12 `availability` POSTs in booking session |
| **Fix** | 300ms debounce; single range query; `keepPreviousData`; day-keyed bounds |
| **Files** | `components/app/appointment-booking-form.tsx`, `lib/query/availability-range-bounds.ts` |
| **Target** | ≤ 3 availability POSTs per session |

---

## openProjectId URL strip

| | |
|---|---|
| **Problem** | `?openProjectId=` stayed in URL after sheet open → re-bootstrap on navigation |
| **HAR** | Extra POST `/projekte` on soft nav |
| **Fix** | Strip query param when sheet opens |
| **Files** | `components/app/projekte-list-client.tsx` |

---

## Upload without core refetch

| | |
|---|---|
| **Problem** | Upload triggered `afterAttachmentChange` → full `getProjectCore` |
| **HAR** | Extra `core` POSTs during photo upload |
| **Fix** | Action returns signed attachment; `patchAttachmentAdded` |
| **Files** | `app/(app)/actions.ts`, `lib/query/hooks.ts`, `lib/query/invalidations.ts` |

---

## Auftrag extras bundle merge

| | |
|---|---|
| **Problem** | Stale extras cache after realtime attachment changes |
| **HAR** | Duplicate fetches or missing photos until reload |
| **Fix** | Client merge prefers fresher live attachments from core cache |
| **Files** | `components/app/monteur-auftrag-client.tsx` |

---

## Monteur hooks unified (PR-F)

| | |
|---|---|
| **Problem** | Direct server action calls bypassed shared cache patches |
| **HAR** | Extra POSTs on rapport/notes/delete vs office path |
| **Fix** | `useUpdateAttachmentNotes`, `useDeleteAttachment`, `useSubmitTechnicianReport` |
| **Files** | `monteur-auftrag-client.tsx`, `lib/query/hooks.ts` |

---

## Prefetch noise

| | |
|---|---|
| **Problem** | Next.js prefetched `_rsc` for sidebar, bottom nav, auftrag cards |
| **HAR** | Many `GET /*?_rsc=` before user navigation |
| **Fix** | `prefetch={false}` on sidebar links, bottom nav, `TechAuftragLink` |
| **Files** | Sidebar component, tech nav, `TechAuftragLink` |
| **Target** | 0 early `_rsc` on `/tag` checklist |

---

## Kalender lazy sheet

| | |
|---|---|
| **Problem** | Full `ProjektSheetEditor` in kalender bundle |
| **Fix** | `dynamic()` import in `kalender-project-sheet.tsx` |
| **Benefit** | Smaller initial `/kalender` JS |

---

## Kalender URL sync (no RSC reload)

| | |
|---|---|
| **Problem** | `router.replace` on day/view/sheet URL refetched RSC |
| **HAR** | `GET /kalender?_rsc=` 200–650ms per click |
| **Fix** | `history.replaceState` in `admin-calendar.tsx`, `kalender-sheet-context.tsx` |
| **Target** | 0 `_rsc` on day change |

---

## Auftrag defer + PR-E

| | |
|---|---|
| **Problem** | TTFB blocked on storage signing + templates; extras reloaded full core |
| **HAR** | Slow document; redundant core in extras POST |
| **Fix** | SSR core only; deferred `fetchAuftragExtrasAction`; head + attachments only in extras |
| **Files** | `app/(tech)/auftrag/[projectId]/page.tsx`, `lib/auth/auftrag-access.ts`, repository |
| **Target** | 1× extras POST, 0× core refetch on load |

---

## Signed URLs and mobile images

| | |
|---|---|
| **Problem** | Office sheet had no `signedUrl`; empty mobile MIME broke image filter |
| **HAR** | N/A — functional; affects upload/display gates |
| **Fix** | `signAttachmentUrls`; `isLikelyProjectImage` in `lib/storage/mime.ts` |
| **Files** | Sheet actions, `projekt-sheet-editor.tsx`, `monteur-auftrag-client.tsx` |

See [related-domain.md](./related-domain.md).

---

## Required technician on booking

| | |
|---|---|
| **Problem** | Empty assignee allowed → failed validation retries |
| **Fix** | UI block + Zod + server reject |
| **Files** | `appointment-booking-form.tsx` |

---

## assignable profiles lazy

| | |
|---|---|
| **Problem** | Eager `listAssignableProfiles` on every `/projekte` load |
| **Fix** | Fetch on sheet open only (Phase 1+) |
| **Benefit** | Smaller bootstrap / RSC |

---

## 3-minute interaction capture script

1. Open project sheet → book 2 appointments (change dates)
2. Kalender → Tag → back to Projekte
3. Open Auftrag → rapport + 2 photos

```bash
node scripts/perf/summarize-har.mjs ~/interaction.har
```

Check classification summary at end of script output.

---

## Optional RPC backlog (interaction-related)

| Path | Symptom | Deferred RPC |
|------|---------|--------------|
| Sheet open | `getProjectCore` 907ms–2.7s slow_operation | `project_core_bootstrap` |
| Availability range | Still 3 POSTs at limit | `availability_range_for_org` |

Requires **explicit user approval** for migrations.
