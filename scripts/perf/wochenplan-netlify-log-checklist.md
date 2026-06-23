# Wochenplan — Netlify Function-Log Checkliste

Nach Deploy auf Prod (`app.gross-storenbau.ch`). Dauer: ~5 Minuten.

## Vorbereitung

1. Netlify → **Logs & metrics** → **Functions** → Real-time
2. Filter: `fetchWeekTasksAction` oder `fetchTechMonthTasksAction`

## Test-Session

| Schritt | Aktion | Erwartung in Logs |
|---------|--------|-------------------|
| 1 | `/wochenplan` hard reload | **1×** Document; **0×** POST nach Load |
| 2 | Tab **Monat** wählen (gleicher Monat wie `day` in URL) | **0×** POST (`techMonthTasks` im dehydrated JSON) |
| 3 | Pfeil **nächster Monat** | **max. 1×** POST (anderer Monat, erwartet) |
| 4 | Tab **Woche** / **Tag** | **0×** POST wenn Week-Key noch im Cache |
| 5 | Von `/tag` → Wochenplan (gleiche Woche) | **0×** Week-POST (shared `weekTasks.byDate`) |

## Regression erkannt?

| Symptom | Wahrscheinliche Ursache |
|---------|-------------------------|
| POST `/wochenplan` direkt nach Load | Hybrid-SSR / `WochenplanHydrationBoundary` nicht live |
| POST bei Monats-Tab ohne Monatswechsel | Month nicht im Bootstrap oder `refetchOnMount` |
| Auftrag-Karten prefetchen | `TechAuftragLink` ohne `prefetch={false}` |

## Parallel: HAR

```bash
node scripts/perf/summarize-har.mjs ~/Desktop/app.gross-storenbau.ch.har
```

**Wochenplan gates (load-only HAR)** — beide `PASS`:

- `early (<500ms)` = **0**
- `Load POST /wochenplan` = **0**
