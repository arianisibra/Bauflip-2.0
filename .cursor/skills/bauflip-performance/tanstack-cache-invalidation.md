# TanStack cache and invalidation

Files: [`lib/query/invalidations.ts`](../../../lib/query/invalidations.ts), [`lib/query/hooks.ts`](../../../lib/query/hooks.ts), [`lib/query/keys.ts`](../../../lib/query/keys.ts)

## Principles

1. **primeCore** when mutation returns full `ProjectCore`
2. **patch*** when mutation returns or implies attachment delta
3. **Scoped invalidation** when geographic/temporal scope is known
4. **Realtime** invalidates broadly when scope unknown

---

## primeCore

Use after mutations that return complete project core (status, stammdaten, rapport with full core):

- Updates `core`, `coreDetails`, `auftragCore`, list rows, bootstrap meta as needed
- Avoids separate `getProjectCore` refetch

`afterProjectCoreChange` — used after rapport submit (`useSubmitTechnicianReport` — PR-F).

---

## patch helpers (prefer for attachments)

| Function | When |
|----------|------|
| `patchAttachmentAdded` | Upload returns signed attachment |
| `patchAttachmentNotesUpdated` | Notes save |
| `patchAttachmentRemoved` | Delete attachment |

Updates in one place: `core`, `coreDetails`, `auftragCore`, `auftrag-extras` attachment lists.

### When NOT to use `afterAttachmentChange`

`afterAttachmentChange` triggers **full core refetch** — too heavy for notes/delete/upload.

**Use patches for:** notes update, delete, upload (interaction phase + PR-F).

---

## Appointment invalidation (PR-G)

### Scoped — client mutations with known window

```typescript
invalidateAppointmentRangeCaches(qc, appointmentWindow, invOpts);
```

Called from `invalidateProjectAdjacencies` when `appointmentWindow` passed.

Invalidates only affected week/range keys — not global `weekTasks.all()`.

**Use when:** `useAddAppointment`, `useDeleteAppointment` know slot bounds.

### Broad — realtime

`afterAppointmentChange` from realtime bridge — window often unknown → broader invalidation acceptable.

---

## List and bootstrap invalidation

| Event | Typical invalidation |
|-------|---------------------|
| Project status change | List + bootstrap meta counts |
| Realtime `project.changed` | `projekte` list/bootstrap |
| Filter change | URL sync + query key includes filter |
| Realtime mutation on list | Reset to page 1 (by design) |

**PR-H backlog:** dedupe bootstrap refetch + infinite page-1 on filter change — risk of SSR/client desync.

---

## Auftrag cache

| Query | Notes |
|-------|-------|
| `auftragCore` | SSR `initialData`; `refetchOnMount: false` |
| `auftrag-extras` | Merged in client; prefer fresher live attachments (`monteur-auftrag-client.tsx`) |
| PR-E | Extras fetch does not reload reports via full `getProjectCore` |

---

## Bestellformulare pattern

After CMS save/create/delete: **`setQueryData`** + realtime publish — not mutation + full refetch (was 2× POST).

---

## Einstellungen pattern

After profile save: `setQueryData` for immediate header/form sync — no wait for refetch.

---

## Query key conventions

- Swiss week: `weekTasks.byDate(refIso)` — shared `/tag` and `/wochenplan`
- Availability: range bounds as key part — must match debounced fetch range
- Projekte: `projekte.bootstrap(status)`, `projekte.list(filter, search, cursor)`
- Project core: `projects.core(projectId)`, `projects.coreDetails(projectId)`

---

## Debugging cache misses

1. Compare dehydrated key in RSC vs client hook (timezone!)
2. Check `staleTime` / `gcTime` on bootstrap queries (~3 min cache on repeat nav)
3. Look for duplicate hooks fetching same page-1 (PR-H target)
4. Verify mutation `onSuccess` calls patch not invalidate

---

## Verification

| Scenario | Expected POST count |
|----------|---------------------|
| Upload photo in sheet | 1× upload, 0× core |
| Edit attachment notes | 1× notes, 0× core |
| Delete attachment | 1× delete, 0× core |
| Add appointment | 1× mutation + scoped invalidation |
| Rapport submit (Monteur) | 1× rapport + `afterProjectCoreChange` |

Use interaction HAR gates in [har-measurement.md](./har-measurement.md).
