# Kalender — Netlify Function-Log Checkliste

Nach Deploy auf Prod (`app.gross-storenbau.ch`). Dauer: ~5 Minuten.

## Vorbereitung

1. Netlify → **Logs & metrics** → **Functions** → Real-time
2. Filter: `weekTasksFromAppointmentRange` (optional zweiter Tab: `api/events`)

## Test-Session

| Schritt | Aktion | Erwartung in Logs |
|---------|--------|-------------------|
| 1 | Kalender hard reload (`Cmd+Shift+R`) | **1×** `Duration: ~900ms`; **max. 1×** `slow_operation weekTasksFromAppointmentRange` |
| 2 | Termin klicken → Sheet öffnen | **1×** kürzere Invocation (`getProjectCore`); **0×** neue `weekTasks` |
| 3 | Sheet schliessen | **0×** neue Invocations |
| 4 | Schritt 2–3 **2× wiederholen** | weiter **0×** `weekTasks` pro Klick |
| 5 | Anderen Tag wählen (Pfeil / Datumswechsel) | **0×** `GET /kalender?_rsc` in Observability; ggf. **1×** POST `/kalender` wenn Range neu |
| 6 | Filter `api/events` | **0** Treffer (Supabase Realtime aktiv) |

## Regression erkannt?

| Symptom | Wahrscheinliche Ursache |
|---------|-------------------------|
| Burst 10+ Invocations in 10 s ohne Navigation | Sheet oder Kalender-URL nutzt noch `router.replace` |
| `Duration: 60000 ms` | SSE `/api/events` noch deployed — Realtime-Migration prüfen |
| `weekTasks` bei jedem Sheet-Klick | `kalender-sheet-context` Fix nicht live |
| Parallele `GET /projekte?_rsc=` beim Kalender-Load | Sidebar-Prefetch — `prefetch={false}` prüfen |

## Parallel: HAR

```bash
# Interaktions-HAR exportieren, dann:
node scripts/perf/summarize-har.mjs ~/Desktop/app.gross-storenbau.ch.har
```

Erwartung im Summary-Block **Kalender gates (interaction HAR)** — alle `PASS`:

- `early (<500ms)` = **0** (kein Hydration-Re-Fetch)
- `sheet` POSTs auf `/kalender?sheet=` = kleine Payloads, **kein** `_rsc`
- `range/view` POSTs = nur bei Ansichtswechsel
