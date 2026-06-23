# Related domain fixes (perf-adjacent)

Not performance code per se, but **breaks or distorts HAR gates** if regressed.

---

## Project status on appointment booking

**Rule:** `nextProjectStatusAfterAppointmentBooked` in [`lib/domain/types.ts`](../../../lib/domain/types.ts)

| From status | When upcoming appointment booked |
|-------------|----------------------------------|
| `offen` (first appointment) | → `abgemacht` |
| `einsatz_offen` | → `montagebereit` |
| `werkstatt` (and similar) | → `abgemacht` |

**Bug fixed:** `werkstatt` returned `null` → status never updated on booking.

**Perf link:** Status change invalidates list/bootstrap — extra POSTs if booking appears to «fail» and user retries.

---

## ABGEMACHT list sort

Filter `status=abgemacht`: sort by `nextAppointmentStartsAt` ascending (nearest first); projects without appointment at bottom.

File: [`lib/projekte/list-sort.ts`](../../../lib/projekte/list-sort.ts)

**Perf link:** Requires `next_appointment_starts_for_org` RPC or attachment of next appointment fields — only loaded for abgemacht filter (Phase 2a defer).

---

## Attachments and signed URLs

| Issue | Fix |
|-------|-----|
| Office sheet no `signedUrl` | Sign in sheet/core actions |
| Mobile `file.type === ""` | `isLikelyProjectImage(fileType, fileName)` |
| HEIC uploads blocked | Storage bucket MIME migration `20260512120000_project_files_bucket_heic.sql` |
| Per-file sign errors ignored | Only set URL when no row error |

Files: `lib/storage/mime.ts`, `signAttachmentUrls`, `projekt-sheet-editor.tsx`, `monteur-auftrag-client.tsx`

**Perf link:** Upload gate assumes `patchAttachmentAdded` — broken signing causes retry/refetch loops.

---

## Kalender navigation (UX, prefetch-related)

- `sanitizeAppReturnTo` — [`lib/navigation/app-return-to.ts`](../../../lib/navigation/app-return-to.ts)
- `OfficeReturnBar` — back from projekte sheet to kalender
- Deep link: `/projekte?openProjectId=&from=kalender&returnTo=/kalender?...`

**Perf link:** Wrong return URLs cause extra navigations and bootstrap POSTs.

---

## Required technician on booking

`assignedTechnicianId` required in UI, Zod, and server action.

**Perf link:** Prevents invalid submit → retry POST storms.

---

## Downsizing context

Smaller schema and fewer features → leaner `repository.ts` and fewer routes to optimize.

See [`docs/archive/DOWNSIZING-RESULTS.md`](../../../docs/archive/DOWNSIZING-RESULTS.md).

---

## When to touch this file

- Investigating «extra POSTs» that are user retries, not cache bugs
- Adding new status transition that should invalidate projekte list
- Changing attachment pipeline — re-run interaction HAR gates
