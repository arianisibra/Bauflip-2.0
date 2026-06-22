# Phase 2b — Listendaten verschlanken

Stand: 2026-06-22

## Ausgangslage (nach Phase 2c + 2d)

| Metrik | Prod warm |
|--------|-----------|
| `/projekte` total | ~838 ms |
| TTFB | ~394 ms |
| Receive | ~437 ms |
| RSC Content (unkompr.) | ~353 KB |
| Wire transfer | ~17 KB |
| Initial Projekte | 50 |
| Bootstrap POST | 0× |

Punkte 1–3 der ursprünglichen Phase-2-Spec (Pagination, Default aktiv, RPC defer) sind **bereits umgesetzt**. Der grosse RSC blieb, weil **pro Zeile zu viele Felder** serialisiert wurden.

## Optionen

| Option | UI | RSC-Ziel | Umsetzung |
|--------|-----|----------|-----------|
| **A (gewählt)** | Adresse-Spalte entfernt; Details im Sheet | ~120–180 KB | `PROJECT_LIST_SLIM_COLUMNS`, schlanke `OfficeProjectListItem` |
| B | Spalten bleiben | ~250–280 KB | Nur JSON-Deduplizierung, marginal |

## Umsetzung Option A

### DB / Repository

- Listen-Select: `id, title, type, status, tenant_name, created_at` (keine Adress-Spalten in Response)
- Server-Suche: `ilike` weiter auf Adress-/Referenz-Felder in DB, Felder nicht im JSON
- `nextAppointmentStartsAt` nur bei Filter `abgemacht` (RPC)
- Kein `displayLabel` / `serviceAddressShort` in Listen-Payload

### UI

- Tabelle: Mieter/Kontakt, Typ, Status, Aktion (Adresse nur im Sheet)
- Mobile: Adresszeile entfernt
- Sheet lädt weiter vollständige Daten via `getProjectSheetDataAction`

### Constraints (unverändert)

- RLS aktiv, keine Security-Änderung
- Kein SSE / `/api/events`
- Kein Bootstrap-POST (Hybrid-SSR)

## HAR-Vergleich nach Deploy

```bash
node scripts/perf/summarize-har.mjs ~/Desktop/app.gross-storenbau.ch.har
```

| Metrik | Vorher (2d) | Ziel 2b |
|--------|-------------|---------|
| Content | ~353 KB | ~120–180 KB |
| Receive | ~437 ms | ~150–250 ms |
| Total | ~838 ms | ~650–750 ms |
| displayLabel count | 50 | 50 (title only) |
| Projekte initial | 50 | 50 |

Checkliste: total, TTFB, Receive, Content-Grösse, Anzahl `title`/Zeilen im Payload.
