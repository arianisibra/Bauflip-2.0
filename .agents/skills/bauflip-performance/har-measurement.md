# HAR measurement

## Capture procedure

1. **Incognito** without browser extensions (or filter hostname only).
2. Chrome DevTools → Network → **Disable cache**.
3. Log in to target environment (prod: `app.gross-storenbau.ch`).
4. **Hard reload** twice — use second reload for **warm** baseline.
5. For interaction sessions, follow route checklists (below).
6. Export: **Save all as HAR with content**.

## Summarize

```bash
node scripts/perf/summarize-har.mjs ~/Desktop/app.gross-storenbau.ch.har
BAUFLIP_HAR_HOST=localhost node scripts/perf/summarize-har.mjs ~/Desktop/localhost.har
```

Script: [`scripts/perf/summarize-har.mjs`](../../../scripts/perf/summarize-har.mjs)

### Timing constants (in script)

| Constant | Value | Meaning |
|----------|-------|---------|
| `HYDRATION_GAP_MS` | 500 | POST within this after document = hydration regression |
| `NAV_PREFETCH_GAP_MS` | 2000 | Bottom-nav prefetch noise window |
| `AUFTRAG_PREFETCH_GAP_MS` | 3000 | Auftrag `_rsc` prefetch after `/tag` |

### POST body classification

`summarize-har.mjs` heuristically tags POST `/projekte` bodies:

| Tag | Typical action |
|-----|----------------|
| `bootstrap` | Initial list + meta |
| `availability` | `fetchAvailabilityRangeAction` |
| `list` | Pagination / filter page |
| `mutation` | Status, stammdaten, appointment CRUD |
| `core` | `getProjectSheetBootstrapAction` / sheet head+details |
| `upload` | Multipart attachment upload (`projectId` in form) |
| `extras` | Auftrag extras bundle |
| `rapport` | Technician report |
| `upload` | Attachment upload |

Not every POST is bootstrap — use tags when diagnosing interaction sessions.

### Next.js 16 action IDs

Server Actions may post **`["<project-uuid>"]`** without function names in the HAR body. The script treats a single UUID v4 argument as **`core`** (sheet bootstrap). Multipart with `projectId` → **`upload`**.

### Sheet gates (PR-I) — script output

After summarize, look for **Sheet gates (PR-I)**:

| Gate | PASS when |
|------|-----------|
| 1 core POST per open | Count matches sheet opens (not 2× waterfall) |
| No burst | No two `core` POSTs within **300 ms** |

Checklist: [`scripts/perf/sheet-open-checklist.md`](../../../scripts/perf/sheet-open-checklist.md)

---

## Per-route first-load gates

| Route | Document POST after load | Other |
|-------|--------------------------|-------|
| `/projekte` (Hybrid-SSR) | **0×** bootstrap | RSC contains ~50 rows |
| `/kalender` | **0×** within 500ms | Data ≈ document end |
| `/mitarbeiter` | **0×** | Team + absences dehydrated |
| `/einstellungen` | **0×** | Profile + org dehydrated |
| `/bestellformulare` | **0×** | Templates dehydrated |
| `/tag` | **0×** | Week tasks dehydrated |
| `/wochenplan` | **0×** week; **1×** month if tab without `?view=month` | |
| `/auftrag/[id]` | **1×** extras | **0×** core refetch after SSR |

---

## Interaction session gates

### Projekte — Termin buchen + Auftrag

Checklist: [`scripts/perf/projekte-interaction-checklist.md`](../../../scripts/perf/projekte-interaction-checklist.md)

| Session | Metric | Target |
|---------|--------|--------|
| Termin buchen (2 appointments, tweak dates) | POST `/projekte` total | **≤ 8** |
| Same session | `availability` POSTs | **≤ 3** |
| Auftrag rapport + 2 photos | POST `/auftrag` | **≤ 4**, **0×** core refetch |

### Kalender — sheet + view change

| Check | Target |
|-------|--------|
| POST `/kalender` within 500ms of document | **0×** |
| Sheet open (`getProjectCore`) | **1–2×** on `/kalender?sheet=`, not `/projekte` |
| Day/view change | **0×** `GET /kalender?_rsc=` (use `replaceState`) |
| View range change | **1×** POST per new range (expected) |

Checklist: [`scripts/perf/kalender-netlify-log-checklist.md`](../../../scripts/perf/kalender-netlify-log-checklist.md)

### Other route checklists

- [`mitarbeiter-netlify-log-checklist.md`](../../../scripts/perf/mitarbeiter-netlify-log-checklist.md)
- [`tag-netlify-log-checklist.md`](../../../scripts/perf/tag-netlify-log-checklist.md)
- [`wochenplan-netlify-log-checklist.md`](../../../scripts/perf/wochenplan-netlify-log-checklist.md)
- [`einstellungen-netlify-log-checklist.md`](../../../scripts/perf/einstellungen-netlify-log-checklist.md)
- [`bestellformulare-netlify-log-checklist.md`](../../../scripts/perf/bestellformulare-netlify-log-checklist.md)

---

## Pitfalls

| Symptom | Cause | Fix |
|---------|-------|-----|
| ~118 requests, 6 MB | Browser extensions (`inject.bundle.js`) | Incognito; filter `gross-storenbau` |
| `Failed to find Server Action` | Deploy mismatch | Hard reload after deploy |
| No document GET in HAR | Captured mid-session | Timeline uses first POST as anchor |
| 5× identical bootstrap in dev | React strict mode / double mount | Compare prod HAR, not dev alone |
| Cold ~4.8s first invocation | Netlify cold start | Second reload for warm baseline |
| `GET /api/events` | Old deploy | Realtime migration — should be **0** |

---

## Prod measurement notes

- Filter hostname: `gross-storenbau` or set `BAUFLIP_HAR_HOST`.
- Bootstrap ~60 KB on prod vs ~18 KB local = more projects + assignable profiles in payload — not necessarily a bug.
- Compare **wire transfer** vs **uncompressed RSC content** — gzip makes wire small while DevTools content size stays large.

---

## After deploy verification

```bash
node scripts/perf/summarize-har.mjs <new.har>
# Compare to baseline in docs/performance-production-har.md
```

For DB-backed wins, also check Netlify function logs for `slow_operation` lines and RPC fallback warnings (`*_rpc_fallback` in dev logs).
