# Tag (Mein Tag) — Netlify Function-Log Checkliste

Nach Deploy auf Prod (`app.gross-storenbau.ch`). Dauer: ~5 Minuten.

## Vorbereitung

1. Netlify → **Logs & metrics** → **Functions** → Real-time
2. Filter: `calendar_range_tasks_for_org` oder `fetchWeekTasksAction`

## Test-Session

| Schritt | Aktion | Erwartung in Logs |
|---------|--------|-------------------|
| 1 | `/tag` hard reload (`Cmd+Shift+R`) | **1×** Document (~700–1200 ms); **0×** POST `fetchWeekTasksAction` nach Load |
| 2 | Terminliste sichtbar ohne Spinner-Gap | Daten im dehydrated JSON (kein zweiter Roundtrip) |
| 3 | Bottom-Nav Tabs sichtbar | **0×** `GET /wochenplan?_rsc=` und **0×** `GET /profil?_rsc=` direkt nach Load |
| 4 | Auftrag-Karte öffnen | **1×** Document `/auftrag/[id]` (erwartet) |
| 5 | Zurück zu `/tag` | **0×** POST wenn Cache noch fresh (`staleTime` 90 s) |

## Regression erkannt?

| Symptom | Wahrscheinliche Ursache |
|---------|-------------------------|
| POST `/tag` innerhalb 500 ms nach Document | Hybrid-SSR / `TagHydrationBoundary` nicht live |
| POST `/tag` ~800 ms nach Load | `refetchOnMount` nicht `false` oder fehlender Bootstrap |
| `GET /wochenplan?_rsc=` beim Load | `TechBottomNav` ohne `prefetch={false}` |
| Liste stale nach Büro-Terminänderung | Realtime `appointment.changed` / `weekTasks` invalidate prüfen |

## Parallel: HAR

```bash
node scripts/perf/summarize-har.mjs ~/Desktop/app.gross-storenbau.ch.har
```

Erwartung im Block **Tag gates (load-only HAR)** — alle `PASS`:

- `early (<500ms)` = **0**
- `Load POST /tag` = **0**
- `GET /wochenplan?_rsc=` early (<2s) = **0**
- `GET /profil?_rsc=` early (<2s) = **0**
- `GET /auftrag/*?_rsc=` early (<3s) = **0**
