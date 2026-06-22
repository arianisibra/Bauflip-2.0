# Mitarbeiter — Netlify Function-Log Checkliste

Nach Deploy auf Prod (`app.gross-storenbau.ch`). Dauer: ~5 Minuten.

## Vorbereitung

1. Netlify → **Logs & metrics** → **Functions** → Real-time
2. Filter: `listTeamMembers` oder `mitarbeiter_office_bootstrap`

## Test-Session

| Schritt | Aktion | Erwartung in Logs |
|---------|--------|-------------------|
| 1 | `/mitarbeiter` hard reload (`Cmd+Shift+R`) | **1×** Document (~700–1200 ms); **0×** POST `listTeamMembers` / `listAbsences` / `listAssignableProfiles` nach Load |
| 2 | Abwesenheiten-Drawer öffnen | **max. 1×** `listAssignableProfiles` (lazy); **0×** `listTeamMembers` |
| 3 | Drawer schliessen | **0×** neue Invocations |
| 4 | Einladung senden | **1×** `inviteEmployeeAction`; danach Realtime `membership.changed` → Team-Cache refresh |
| 5 | Avatar → Einstellungen hover | **0×** `GET /einstellungen?_rsc=` (prefetch={false}) |

## Regression erkannt?

| Symptom | Wahrscheinliche Ursache |
|---------|-------------------------|
| 3× POST `/mitarbeiter` direkt nach Load | Hybrid-SSR / HydrationBoundary nicht live |
| `listTeamMembers` > 1 s | N+1 Auth oder RPC-Fallback — `mitarbeiter_office_bootstrap` prüfen |
| `GET /einstellungen?_rsc=` beim Load | Avatar-Link ohne `prefetch={false}` |
| Team-Liste nach Einladung stale | `membership.changed` / `afterMembershipChange` fehlt |

## Parallel: HAR

```bash
node scripts/perf/summarize-har.mjs ~/Desktop/app.gross-storenbau.ch.har
```

Erwartung im Block **Mitarbeiter gates (load-only HAR)** — alle `PASS`:

- `early (<500ms)` = **0**
- `GET /einstellungen?_rsc=` = **0**
