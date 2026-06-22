# Bestellformulare — Netlify Function-Log Checkliste

Nach Deploy auf Prod (`app.gross-storenbau.ch`). Dauer: ~5 Minuten.

## Vorbereitung

1. Netlify → **Logs & metrics** → **Functions** → Real-time
2. Filter: `listOrderFormTemplates` oder `createOrderFormCms`

## Test-Session

| Schritt | Aktion | Erwartung in Logs |
|---------|--------|-------------------|
| 1 | `/bestellformulare` hard reload (Admin) | **1×** Document; **0×** POST `listOrderFormTemplatesForOrgAction` nach Load |
| 2 | Formular erstellen | **1×** `createOrderFormCmsAction`; **0×** Refetch-POST (Cache via `setQueryData`) |
| 3 | Formular speichern | **1×** `updateOrderFormCmsAction`; Realtime `order_form_template.changed` |
| 4 | Zweiter Admin-Tab offen | Nach Save in Tab 1: Tab 2 invalidiert via Realtime |

## Regression erkannt?

| Symptom | Wahrscheinliche Ursache |
|---------|-------------------------|
| 1× POST `/bestellformulare` direkt nach Load | Hybrid-SSR nicht live |
| 2× POST pro Save (mutation + list) | `setQueryData` fehlt, nur `invalidateQueries` |
| Cross-Tab stale | `publish(order_form_template.changed)` fehlt in Actions |
| Doppel-Spinner | `dynamic()` + POST-Waterfall — statischer Import prüfen |

## Parallel: HAR

```bash
node scripts/perf/summarize-har.mjs ~/Desktop/app.gross-storenbau.ch.har
```

Erwartung im Block **Bestellformulare gates (load-only HAR)** — alle `PASS`:

- `early (<500ms)` = **0**
- `Load POST /bestellformulare` = **0**
