# Clean interaction HAR — Termin buchen only

Use this capture when the **interaction gate** failed on a long “kitchen sink” session (multiple projects, search, sidebar tour). The gate counts **POST `/projekte` total ≤ 8** for a minimal Termin-buchen flow.

## Why a dedicated capture

A polluted session (e.g. 23.06.2026 prod HAR: **12 POST**, 4× core, search `?q=test`, tag/kalender/auftrag nav) **fails the gate** even when PR-I sheet architecture is correct. This checklist isolates the interaction budget.

## Capture (~3 minutes)

1. Chrome **Incognito** — disable Grammarly, HubSpot, Apollo, and similar extensions.
2. DevTools → Network → **Disable cache** → **Preserve log** off (fresh session).
3. Log in → `https://app.gross-storenbau.ch/projekte`
4. **Do not** search, filter, or open other sidebar routes.
5. Click **one** project → wait for sheet to load.
6. **Termin buchen**: pick Monteur, adjust start/end **once or twice** (availability check), save **one** appointment.
7. Close sheet (optional).
8. Stop recording → **Save all as HAR with content**.

## Analyze

```bash
node scripts/perf/summarize-har.mjs ~/Desktop/termin-buchen-clean.har
```

## Expected gates

| Gate | Target |
|------|--------|
| POST `/projekte` total | **≤ 8** |
| `availability` POSTs | **≤ 3** |
| `core` POSTs | **1** (single sheet open) |
| Bootstrap POST after document | **0** (Hybrid-SSR) |

Typical breakdown: 1× core, 1–2× availability, 1× mutation, 0–1× list refetch.

## If still FAIL

Note the script’s POST breakdown (`core`, `list`, `availability`, `mutation`, `upload`, `other`) and compare with [`docs/performance-production-har.md`](../../docs/performance-production-har.md) Post-Audit section.

## Related

- Full stress session: [`projekte-interaction-checklist.md`](./projekte-interaction-checklist.md)
- Sheet-only PR-I: [`sheet-open-checklist.md`](./sheet-open-checklist.md)
