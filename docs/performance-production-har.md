# Performance: Dev-HAR vs. Production-Baseline

Stand: 2026-05-26 (Phase C)

## Phase C — Erwartung (`npm run build && npm run start`)

| Route | Server-Action POSTs (kalt) | Profil-POST |
|-------|---------------------------|-------------|
| `/projekte` | **1×** `fetchProjekteBootstrapAction` | **0** (Layout) |
| `/tag`, `/wochenplan`, `/profil` | Wochen-/Tagesdaten nur | **0** |
| `/mitarbeiter`, `/bestellformulare` | Team/Templates | **0** (RSC-Guard + Context) |

| Metrik | Phase B | Phase C |
|--------|---------|---------|
| Membership+Profile DB pro Mutation | 2 Queries | **0** (Layout-Session) |
| Proxy membership DB | Jeder Request | **0** nach metadata-Backfill |
| Status-Filter `/projekte` | Client-only | **Server** `.eq(status)` |

---

## Warm Dev-HAR (`localhost.har`, `/projekte`, nach Phase 1)

| Phase | Dauer |
|-------|-------|
| Document `GET /projekte` | ~341 ms (TTFB ~124 ms) |
| Hydration bis erste POST | ~617 ms |
| Branding-POST | ~262 ms |
| Bootstrap-POST (~83 KB) | ~539 ms |
| **Daten sichtbar gesamt** | **~1,43 s** |

Vorher: 3 POSTs, ~2+ s bis Daten.

---

## Phase 2 — Erwartung nach Deploy

| Metrik | Vorher (Warm) | Nach Phase 2 |
|--------|---------------|--------------|
| Server-Action POSTs auf `/projekte` | 2 (Branding + Bootstrap) | **1** (Bootstrap inkl. Branding) |
| `current_organization_id` RPC pro Bootstrap | 2× | **1×** (OrgId aus Session) |
| SSE/Mutationen invalidieren weiter | **Supabase Realtime** (kein Netlify-Dauerstream) |
| Repeat-Navigation `/projekte` | Oft **0 POST** (Cache < 3 min) |
| Time-to-List (Warm, geschätzt) | ~1,0–1,2 s |

### Umgesetzt in Phase 2 + Realtime-Migration

| Massnahme | Dateien |
|-----------|---------|
| Branding in Bootstrap + Cache-Prime | [`app/(app)/projekte/actions.ts`](app/(app)/projekte/actions.ts), [`lib/query/hooks.ts`](lib/query/hooks.ts) |
| Supabase Realtime Broadcast statt `/api/events` | [`lib/realtime/publish.ts`](lib/realtime/publish.ts), [`lib/query/realtime-bridge.tsx`](lib/query/realtime-bridge.tsx) |
| Realtime nur auf Daten-Routen | [`lib/realtime/connect-routes.ts`](lib/realtime/connect-routes.ts) |
| Disconnect bei hidden Tab | [`lib/query/realtime-bridge.tsx`](lib/query/realtime-bridge.tsx) |

### Netlify Observability nach Realtime-Migration

| Metrik | Vorher (SSE) | Nachher |
|--------|--------------|---------|
| `GET /api/events` | Dauernd, ~23–60 s | **0** |
| Function `Duration: 60000 ms` | ~1×/Min pro Tab | **0** (kein Streaming-Handler) |
| Cross-Tab-Sync | Unzuverlässig multi-instance | **Supabase WebSocket** (Browser ↔ Supabase) |

**Nach Deploy prüfen:** Netlify Observability zeigt keine `/api/events`-Zeilen; Function-Logs ohne 60-Sekunden-SSE-Schleife.

---

## Preview-HAR Gate (vor optionaler Phase B)

**Ziel:** Entscheidungsgrundlage, ob Hybrid-SSR für Bootstrap nötig ist.

### Aufnahme

1. Netlify Preview-Deploy mit Phase-2-Branch
2. Chrome DevTools → Network → «Disable cache»
3. Einloggen, `/projekte` hart neu laden (2×: kalt + warm)
4. HAR exportieren (`Save all as HAR with content`)

### Checkliste

| Prüfpunkt | Erwartung Phase 2 |
|-----------|-------------------|
| `POST` auf `/projekte` (Server Actions) | **1×** Bootstrap |
| Kein `GET /api/events` | Realtime über Supabase WebSocket |
| Daten sichtbar (Warm) | **< 1,5 s** |

### Phase-B-Entscheidung

| Ergebnis Preview-HAR | Aktion |
|----------------------|--------|
| Warm ≤ 1,5 s, 1 POST | **Phase B (Hybrid-SSR) nicht nötig** |
| Hydration-Gap > 500 ms dominiert | Hybrid-SSR für Bootstrap evaluieren |
| Cold Start > +500 ms nur auf Netlify | Beobachten; kein Architektur-Umbau |

---

## Prod-Observability (A4 / A5)

### Slow-Logs

In Netlify Site → Environment variables:

```
SERVER_ACTION_SLOW_MS=800
```

Logs erscheinen als JSON auf stderr, wenn `listProjectsForOffice` o. ä. > 800 ms dauert ([`lib/observability/slow-log.ts`](lib/observability/slow-log.ts)).

### RPC `next_appointment_starts_for_org`

Migration: [`supabase/migrations/20260622140000_perf_next_appointment_rpc.sql`](supabase/migrations/20260622140000_perf_next_appointment_rpc.sql)

Verifikation:

```bash
# Lokal oder Supabase SQL Editor
psql "$DATABASE_URL" -f scripts/perf/verify-next-appointment-rpc.sql
```

Nach Deploy: keine `[bauflip] next_appointment_starts_for_org:` Warnings in Function-Logs (Fallback auf Client-Aggregation wäre langsamer).

**Verifiziert 2026-05-26 (Prod `bauflip`, SQL Editor):**

| Prüfpunkt | Ergebnis |
|-----------|----------|
| `next_appointment_starts_for_org` existiert | `prosecdef=false`, `provolatile=s` |
| Index `idx_appointments_ends_at` | `btree (ends_at)` auf `appointments` |
| Smoke-Test (Gross Storenbau Org) | RPC liefert Zeilen ohne Fehler |

---

## Live Prod — `app.gross-storenbau.ch` (2026-05-26)

HAR exportiert mit Network-Filter (36 Einträge, keine Extension-Requests).

| Metrik | Wert | Phase C |
|--------|------|---------|
| `POST /projekte` (Bootstrap) | **1×**, ~962 ms, **~60 KB** | OK |
| `GET /api/events` | **0** | OK |
| Supabase WebSocket | **1×** | OK |
| Profil-POST | **0** | OK |
| Document TTFB | ~301 ms | normal |
| Document gesamt | ~723 ms | OK |
| Daten sichtbar (kalt, eingeloggt) | ~1,8 s | Cold Start + Bootstrap |

**Netlify Function-Logs (gleicher Besuch):**

| Invocation | Dauer | Zuordnung |
|------------|-------|-----------|
| `f42cf538` | ~4840 ms | Cold Start: Proxy + RSC-Layout |
| `d62be1ae` | ~1007 ms | Bootstrap-POST |
| Static `/_next/static/chunks/*` | 8–50 ms | billig |

**Hinweis:** Screenshots mit ~118 Network-Zeilen stammen von Browser-Extensions (`chrome-extension://…`), nicht von Bauflip. Für künftige Messungen: Incognito ohne Extensions, Filter `gross-storenbau`, «Disable cache», **zweiter** Reload für Warm-Baseline.

**Unauth Redirect-Timing (curl, ohne Cookie):** Run 1 ~1,7 s TTFB (Cold), Run 2 ~244 ms TTFB (Warm) — bestätigt, dass Netlify Cold Start primär den ersten Request trifft.

**Bootstrap ~60 KB vs. lokal ~18 KB:** Mehr Projekte und `listAssignableProfiles` auf Prod; kein Fehler bei ~300 Projekten.

---

## Phase 1 — Hybrid-SSR `/projekte` (2026-05-26)

Liste + Branding werden im **RSC-Page-Load** geladen und per TanStack `HydrationBoundary` dehydriert. Kein initialer Bootstrap-POST bei erstem Besuch.

| Metrik | Phase C (vorher) | Phase 1 (Ziel nach Deploy) |
|--------|------------------|----------------------------|
| `POST /projekte` beim ersten Load | **1×** (~900 ms) | **0×** |
| Daten im Document/RSC | Shell only | Projekte + Branding |
| `listAssignableProfiles` initial | Im Bootstrap | **Lazy** (Sheet öffnen) |
| Hydration-Gap + 2. Invocation | ~135 ms + ~900 ms | **entfällt** |
| Daten sichtbar (Warm) | ~1,8 s | **~Document-TTFB** (geschätzt 0,7–1,2 s) |

**HAR-Vergleich nach Deploy:**

```bash
node scripts/perf/summarize-har.mjs ~/Desktop/app.gross-storenbau.ch.har
# → Baseline Phase C (1× POST, data ready ~1781 ms)

# Nach Deploy: gleiche Aufnahme (Incognito, Filter gross-storenbau, 2. Reload)
node scripts/perf/summarize-har.mjs ~/Desktop/app.gross-storenbau.ch-phase1.har
# Erwartung: Bootstrap POST 0, data ready ≈ document end
```

**Sicherheit:** `organizationId` aus `getLayoutSession()` in der Page; `loadProjekteBootstrapData(orgId)` nur mit expliziter Org — RLS unverändert. `assignableProfiles` weiter per `listAssignableProfilesAction` (org-scoped).

---

## Phase 2a — RPC defer + Default «Aktiv» (2026-06-22)

| Massnahme | Wirkung |
|-----------|---------|
| Default-Filter `active` (ohne `abgeschlossen`) | Kleinerer initialer RSC-Payload |
| RPC `next_appointment_starts_for_org` nur bei `?status=abgemacht` | 1 DB-Roundtrip weniger beim Normal-Load |
| Status-Zähler (`listProjectStatusCountsForOffice`) | Korrekte Dropdown-Labels ohne «Alle» zu laden |
| URL `?status=active\|all\|…` | Reload-stabil, teilbar |

**Prod-Baseline Phase 1 (deployed):** Document ~1311 ms, RSC ~864 KB, Bootstrap POST **0×**.

**Erwartung Phase 2a (Warm, Default `/projekte`):**

| Metrik | Phase 1 | Phase 2a (Ziel) |
|--------|---------|-----------------|
| TTFB | ~480 ms | ~350–420 ms |
| RSC content | ~864 KB | ~15–25 % kleiner |
| RPC | immer | **skipped** (Default) |
| Bootstrap POST | 0× | 0× |

**Messung nach Deploy:**

```bash
# Default (active)
node scripts/perf/summarize-har.mjs ~/Desktop/app.gross-storenbau.ch.har

# Localhost
BAUFLIP_HAR_HOST=localhost node scripts/perf/summarize-har.mjs ~/Desktop/localhost.har

# ABGEMACHT (RPC aktiv)
# Browser: /projekte?status=abgemacht → HAR exportieren
```

**Dev-Log (RPC):** In Development loggt `listProjectsForOffice` JSON mit `listFilter`, `projectCount`, `rpc: skipped|next_appointment_starts_for_org`.

**Manuelle Checkliste:**

1. `/projekte` — nur aktive Projekte, kein POST, kein RPC (Dev-Log: `skipped`)
2. `?status=all` — inkl. abgeschlossen
3. `?status=abgemacht` — Termin-Sortierung, RPC in Dev-Log
4. Dropdown-Zähler stimmen ohne vorher «Alle» zu wählen
5. Filter-Wechsel aktualisiert URL; Reload behält Filter

---

## Phase 2c — Pagination + Server-Suche (Ziel)

| Metrik | Phase 2a | Phase 2c (Ziel) |
|--------|----------|-----------------|
| Prod data ready (warm) | ~866 ms | ~**500–700 ms** |
| RSC initial | ~325 KB | ~**50–80 KB** |
| Zeilen initial | alle aktiven (~200+) | **50** |
| Bootstrap POST | 0× | 0× |

### Umgesetzt

| Massnahme | Dateien |
|-----------|---------|
| Cursor-Pagination (50er Seiten) | [`lib/db/repository.ts`](lib/db/repository.ts) `listProjectsForOfficePage` |
| ABGEMACHT: Vollsort + Offset-Paging | [`lib/projekte/list-sort.ts`](lib/projekte/list-sort.ts), Repository |
| Server-Suche org-weit `?q=` (min. 2 Zeichen) | [`lib/navigation/projekte-list-navigation.ts`](lib/navigation/projekte-list-navigation.ts), Repository |
| SSR dehydriert Seite 1 | [`lib/projekte/server-bootstrap.ts`](lib/projekte/server-bootstrap.ts) |
| «Mehr laden» + Infinite Query | [`lib/query/hooks.ts`](lib/query/hooks.ts), [`components/app/projekte-list-client.tsx`](components/app/projekte-list-client.tsx) |
| Deep-Link `?openProjectId=` Fallback | `fetchOfficeProjectListItemAction` |

**Messung nach Deploy:**

```bash
node scripts/perf/summarize-har.mjs ~/Desktop/app.gross-storenbau.ch.har
BAUFLIP_HAR_HOST=localhost node scripts/perf/summarize-har.mjs ~/Desktop/localhost.har
```

**Manuelle Checkliste Phase 2c:**

1. `/projekte` warm — Document RSC ~50–80 KB, 0 Bootstrap-POST, ~50 Zeilen sichtbar
2. «Weitere laden» — 1 Server Action, Zeilen werden angehängt
3. `?status=abgemacht` — Termin-Sortierung erste Seite plausibel
4. `?q=müller` — Treffer org-weit, URL sync, Hinweis «durchsucht alle Projekte»
5. Kalender-Deep-Link `?openProjectId=` für Projekt auf Seite 2+ — Sheet öffnet
6. Realtime-Mutation — Liste invalidiert, zurück auf Seite 1

---

## Phase 2c — Prod-Baseline (deployed, 2026-06-22)

HAR: `app.gross-storenbau.ch`, Warm, Default `/projekte`, Incognito empfohlen (Extensions erzeugen sonst ~118 Requests / 6 MB Rauschen).

| Metrik | Wert |
|--------|------|
| Document total | ~783 ms |
| TTFB | ~338 ms |
| Wire transfer | **17 KB** |
| RSC unkomprimiert | ~345 KB (50 Zeilen dehydriert) |
| Bootstrap POST | **0×** |
| Projekte im Payload | **50** |
| DOMContentLoaded | ~750 ms |

Vergleich: Phase 2a ~866 ms → **~83 ms schneller**.

---

## Phase 2d — Interne Optimierungen (kein UI-Change)

| Massnahme | Wirkung |
|-----------|---------|
| Dehydration: kein doppeltes `projects.list` + kein Branding in Meta-Query | Kleinerer RSC-Flight |
| RPC `project_status_counts_for_org` | Kein Fetch aller `status`-Zeilen pro Org |
| `pg_trgm`-Indexes für Listensuche | Schnellere `ilike`-Suche |
| Legacy `listProjectsForOffice` entfernt | Weniger toter Code |

Migration: [`20260622190000_perf_status_counts_search_trgm.sql`](supabase/migrations/20260622190000_perf_status_counts_search_trgm.sql)

**Nach Deploy:** `npm run db:push`, dann HAR erneut — erwartet leicht kleinerer RSC + schnellere Suche.

**Mess-Hinweis:** DevTools «118 requests / 6 MB» oft Browser-Extensions (`inject.bundle.js`, `chrome-extension://`) — für Bauflip nur Filter `gross-storenbau` oder Incognito.

---

## Frühere Baselines

### Dev-HAR vor Optimierung

| Metrik | Wert |
|--------|------|
| `onContentLoad` | 508 ms |
| Document `GET /projekte` | 487 ms |
| Daten sichtbar | ~1,7–2,5 s (3× POST) |

### Production lokal (`npm run build && npm start`)

| Route | TTFB | Total |
|-------|------|-------|
| `GET /anmeldung` | ~88 ms | ~88 ms |
| `GET /projekte` (ohne Cookie) | ~4 ms | Redirect |

---

## Nächste Schritte (optional, Phase B)

- `npm run analyze` für Listen-Chunk-Grösse
- Hybrid-SSR Bootstrap nur wenn Preview-HAR Hydration-Gap > 500 ms zeigt
- Bei >500 Projekten: serverseitiger Status-Filter / Pagination
