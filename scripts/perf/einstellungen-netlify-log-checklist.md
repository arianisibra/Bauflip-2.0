# Einstellungen — Netlify Function-Log Checkliste

Nach Deploy auf Prod (`app.gross-storenbau.ch`). Dauer: ~5 Minuten.

## Vorbereitung

1. Netlify → **Logs & metrics** → **Functions** → Real-time
2. Filter: `fetchEinstellungenPageData` oder `saveProfileSettings`

## Test-Session

| Schritt | Aktion | Erwartung in Logs |
|---------|--------|-------------------|
| 1 | `/einstellungen` hard reload (`Cmd+Shift+R`) | **1×** Document (~700–1200 ms); **0×** POST `fetchEinstellungenPageDataAction` nach Load |
| 2 | Profil speichern (Name ändern) | **1×** `saveProfileSettingsAction`; Header-Logo/Name sofort aktuell (TanStack `setQueryData`) |
| 3 | Avatar-Dropdown → Einstellungen hover | **0×** `GET /einstellungen?_rsc=` (`prefetch={false}`) |

## Regression erkannt?

| Symptom | Wahrscheinliche Ursache |
|---------|-------------------------|
| 1× POST `/einstellungen` direkt nach Load | Hybrid-SSR / HydrationBoundary nicht live |
| Spinner «Einstellungen werden geladen …» | Bootstrap fehlt oder Query ohne dehydrated data |
| Header-Logo stale nach Save | `setQueryData` auf `organizationBranding` fehlt |
| `GET /einstellungen?_rsc=` beim Load | Avatar-Link ohne `prefetch={false}` |

## Parallel: HAR

```bash
node scripts/perf/summarize-har.mjs ~/Desktop/app.gross-storenbau.ch.har
```

Erwartung im Block **Einstellungen gates (load-only HAR)** — alle `PASS`:

- `early (<500ms)` = **0**
- `Load POST /einstellungen` = **0**
- `GET /einstellungen?_rsc=` = **0**
