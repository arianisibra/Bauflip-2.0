# Wochenplan — Netlify Function-Log Checkliste

Nach Deploy auf Prod (`app.gross-storenbau.ch`). Dauer: ~5 Minuten.

## Vorbereitung

1. Netlify → **Logs & metrics** → **Functions** → Real-time
2. Filter: `fetchWeekTasksAction` oder `fetchTechMonthTasksAction`

## Test-Session

| Schritt | Aktion | Erwartung in Logs |
|---------|--------|-------------------|
| 1 | `/wochenplan` hard reload (view=day) | **1×** Document; **0×** POST nach Load |
| 2 | Tab **Monat** wählen (ohne `?view=month` in URL) | **1×** POST `fetchTechMonthTasksAction` (Month defer) |
| 3 | Hard reload mit `?view=month&day=YYYY-MM-DD` | **0×** POST Month nach Load |
| 4 | Pfeil **nächster Monat** | **max. 1×** POST (anderer Monat, erwartet) |
| 5 | Tab **Woche** / **Tag** | **0×** POST wenn Week-Key noch im Cache |
| 6 | Von `/tag` → Wochenplan (gleiche Woche) | **0×** Week-POST (shared `weekTasks.byDate`) |

## Regression erkannt?

| Symptom | Wahrscheinliche Ursache |
|---------|-------------------------|
| POST `/wochenplan` direkt nach Load (view=day) | Hybrid-SSR / `WochenplanHydrationBoundary` nicht live |
| POST bei `?view=month` Load | Month nicht im Bootstrap oder `refetchOnMount` |
| Auftrag-Karten prefetchen | `TechAuftragLink` ohne `prefetch={false}` |

## Parallel: HAR

```bash
node scripts/perf/summarize-har.mjs ~/Desktop/app.gross-storenbau.ch.har
```

**Wochenplan gates (load-only HAR, view=day)** — beide `PASS`:

- `early (<500ms)` = **0**
- `Load POST /wochenplan` = **0**
