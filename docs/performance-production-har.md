# Performance: Dev-HAR vs. Production-Baseline

Stand: 2026-05-26 (Phase C)

## Phase C — Erwartung (`npm run build && npm run start`)

| Route | Server-Action POSTs (kalt) | Profil-POST |
|-------|---------------------------|-------------|
| `/projekte` | **1×** `fetchProjekteBootstrapAction` | **0** (Layout) |
| `/tag` | Week-Tasks (Hybrid-SSR) | **0** (Layout) |
| `/wochenplan` | Week + Month (Hybrid-SSR) | **0** (Layout) |
| `/profil` | Nur Session-Context | **0** |
| `/mitarbeiter`, `/bestellformulare` | Team/Templates (Hybrid-SSR) | **0** (dehydrated + Layout) |
| `/einstellungen` | Profil + Org (Hybrid-SSR) | **0** (dehydrated + Layout) |

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

## Phase 2b — Schlanke Listendaten (Option A)

Siehe [`docs/phase-2b-list-slim.md`](docs/phase-2b-list-slim.md).

| Änderung | Wirkung |
|----------|---------|
| Listen-Select ohne Adress-Spalten | Weniger DB + JSON |
| Kein `displayLabel` / `serviceAddressShort` in Payload | ~40 % kleiner pro Zeile |
| Adresse nur im Projekt-Sheet | UI: Spalte entfernt |
| `nextAppointmentStartsAt` nur bei `abgemacht` | Kein Termin-Feld im Default-Load |

**HAR-Ziel nach Deploy:**

| Metrik | Phase 2d | Ziel 2b |
|--------|----------|---------|
| RSC Content | ~353 KB | ~120–180 KB |
| Receive | ~437 ms | ~150–250 ms |
| Total | ~838 ms | ~650–750 ms |

```bash
node scripts/perf/summarize-har.mjs ~/Desktop/app.gross-storenbau.ch.har
```

---

## Phase 2e — Server/DB Roundtrips (kein UI-Change)

| Massnahme | Wirkung |
|-----------|---------|
| RPC `projekte_office_bootstrap` | Liste Seite 1 + Status-Counts in **1 DB-Roundtrip** |
| Branding im App-Layout SSR | Kein Branding-Fetch im Projekte-Bootstrap; Header via Context |
| Partial Index `idx_projects_org_created_active` | Schnellerer Default-Filter «aktiv» |
| Fallback bei RPC-Fehler / `abgemacht` | Bestehende parallele Queries — keine Datenlücke |

Migration: [`20260626120000_perf_projekte_office_bootstrap_rpc.sql`](supabase/migrations/20260626120000_perf_projekte_office_bootstrap_rpc.sql)

**Nach Deploy:** `npm run db:push`, dann HAR erneut.

| Metrik | Phase 2b/2d | Ziel 2e |
|--------|-------------|---------|
| Supabase Roundtrips `/projekte` | 3 | **2** |
| TTFB | ~351 ms | **~280–320 ms** |
| Data ready (warm) | ~816 ms | **~730–780 ms** |
| Dehydrated TanStack Queries | 3 | **2** (bootstrap meta + list) |
| UI/UX | — | **unverändert** |

Verifikation:

```bash
psql "$DATABASE_URL" -f scripts/perf/verify-projekte-bootstrap-rpc.sql
```

Dev-Log: `listMeta.rpc` = `projekte_office_bootstrap` bei Default-Load; `abgemacht` weiter `next_appointment_starts_for_org`.

---

## Kalender Prod-Baseline (deployed, 2026-06-22)

HAR: `app.gross-storenbau.ch.har`, Warm, `/kalender?day=2026-06-22`, Incognito empfohlen (Extensions erzeugen sonst ~119 Requests / 6 MB Rauschen).

| Metrik | Wert |
|--------|------|
| Document total | ~953 ms |
| TTFB (wait) | ~409 ms |
| Wire transfer | **10 KB** |
| RSC unkomprimiert | ~66 KB |
| Termine im Payload | **9** |
| Bootstrap POST `/kalender` | **0×** |
| POST `/projekte` | **0×** |
| `GET /projekte?sheet=` | **0×** |
| Daten sichtbar (Hybrid-SSR) | **~953 ms** (= Document-Ende) |
| Supabase WebSocket | **1×** |
| `GET /api/events` | **0×** |

Vergleich vor Hybrid-SSR + TZ-Fix: redundant POST ~789 ms, data ready ~1917 ms.

```bash
node scripts/perf/summarize-har.mjs ~/Desktop/app.gross-storenbau.ch.har
```

### Interaktions-HAR (Checkliste)

1. Network → «Disable cache», Filter `gross-storenbau`
2. `/kalender?day=2026-06-22` laden
3. Termin klicken → Sheet öffnen → schliessen (2–3×)
4. Optional: Wochenansicht wechseln
5. HAR exportieren → `summarize-har.mjs`

| Prüfpunkt | Erwartung |
|-----------|-----------|
| POST `/kalender` innerhalb **500 ms** nach Document | **0×** (Hydration-Regression) |
| POST `/kalender?sheet=` bei Sheet (getProjectCore) | **1×** kleine Payload (PR-I; vorher 1–2×) |
| POST `/projekte` bei Sheet auf Kalender | **0×** (Actions posten zu `/kalender`, nicht `/projekte`) |
| POST `/kalender` bei View-Wechsel (neuer Range) | **1×** pro Ansicht (Client-Action) |
| `GET /kalender?_rsc=` bei Tag/Sheet | **0×** (replaceState) |

**Verifiziert (Interaktions-HAR, Sheet + Woche):** Document ~2401 ms (kalt), 0 early POST, 1× range POST (4 KB), 2× sheet POST (6 KB + 1 KB), 0× `_rsc`, alle Gates PASS.

---

## Netlify Function-Logs — Kalender-Matrix

Die HAR misst nur Browser-Requests. Netlify Function-Logs zeigen **jede Serverless-Invocation** (RSC, Middleware, Server Actions).

| Log-Muster | Dauer | Ursache | Status |
|------------|-------|---------|--------|
| `Duration: 60000 ms` + `/api/events` | 60 s | SSE-Dauerstream (alt) | **Behoben** — Supabase Realtime |
| Burst 15–20× in wenigen Sekunden + `weekTasksFromAppointmentRange` | 0,4–2,4 s | Sheet mit `router.replace` → RSC-Reload | **Behoben** — `history.replaceState` in [`kalender-sheet-context.tsx`](components/app/kalender-sheet-context.tsx) |
| `slow_operation` `weekTasksFromAppointmentRange` 843–1467 ms | DB | Join appointments + projects + profiles | **1× pro SSR/Reload** normal; Kal-DB-RPC reduziert |
| `Duration: ~950 ms` einmalig | ~1 s | `GET /kalender` Document + SSR Bootstrap | **Normal** |
| `Duration: 500–900 ms` | 0,5–0,9 s | `getProjectCore` (Sheet/Hover) | **Erwartet** — 1× pro Sheet |
| Parallele `GET /*?_rsc=` | 200–650 ms | Sidebar-Link-Prefetch | **Reduziert** — `prefetch={false}` auf Sidebar |
| `GET /kalender?_rsc=` bei Tag-Wechsel | 200–650 ms | `router.replace` Kalender-URL | **Behoben** — `replaceState` in [`admin-calendar.tsx`](components/app/admin-calendar.tsx) |

### Verifikation nach Deploy (5 Minuten)

1. Netlify → Functions → Real-time: Filter `weekTasksFromAppointmentRange`
2. Kalender hard reload → **max. 1** slow_operation
3. 3× Termin klicken + Sheet schliessen → **0** neue `weekTasks`-Zeilen
4. Filter `api/events` → **0** Treffer
5. Tag wechseln → **1** Client-POST oder Cache-Hit, **kein** `_rsc`-Reload

| Aktion | Function-Invocations | `weekTasksFromAppointmentRange` |
|--------|---------------------|--------------------------------|
| Kalender hard reload | **1×** (~950 ms) | **1×** |
| Termin → Sheet | **1×** POST (`getProjectCore`) | **0×** |
| Sheet schliessen | **0×** | **0×** |
| Tag/Ansicht wechseln (Cache hit) | **0–1×** POST | **0–1×** nur bei neuem Range |
| Realtime-Mutation | **0–1×** Refetch | nur wenn Query aktiv |

---

## Phase Mit — Mitarbeiter Hybrid-SSR (Prod-Baseline)

| Metrik | Vorher (Phase C) | Ziel |
|--------|------------------|------|
| Document GET `/mitarbeiter` | ~726 ms Shell, TTFB ~514 ms | Team + Abwesenheiten im dehydrated JSON |
| POST `/mitarbeiter` nach Load | **3×** (1070 / 849 / 633 ms) | **0×** |
| `listTeamMembers` Auth | N× `getUserById` | **1×** `listUsers` oder RPC mit `auth.users` |
| Abwesenheiten-Drawer | `listAssignableProfiles` eager | **lazy** beim Öffnen |
| Avatar → Einstellungen | 2× `_rsc` Prefetch | **0×** (`prefetch={false}`) |

Checkliste: [`scripts/perf/mitarbeiter-netlify-log-checklist.md`](../scripts/perf/mitarbeiter-netlify-log-checklist.md)

Migration: [`20260627120000_perf_mitarbeiter_bootstrap_rpc.sql`](../supabase/migrations/20260627120000_perf_mitarbeiter_bootstrap_rpc.sql)

Verify: [`scripts/perf/verify-mitarbeiter-bootstrap-rpc.sql`](../scripts/perf/verify-mitarbeiter-bootstrap-rpc.sql)

| Aktion | Function-Invocations |
|--------|---------------------|
| Hard reload `/mitarbeiter` | **1×** (SSR Bootstrap) |
| Abwesenheiten-Drawer öffnen | **0–1×** (`listAssignableProfiles` lazy) |
| Einladung senden | **1×** + Realtime `membership.changed` |

---

## Phase Est — Einstellungen Hybrid-SSR (Prod-Baseline)

| Metrik | Vorher (Phase B) | Ziel |
|--------|------------------|------|
| Document GET `/einstellungen` | Shell + Spinner | Profil + Branding im dehydrated JSON |
| POST `/einstellungen` nach Load | **1–2×** (`fetchEinstellungenPageDataAction`) | **0×** |
| Profil-SELECT on load | 2× (Layout snapshot + Client POST) | **1×** (konsolidiert in `getCachedUserProfile`) |
| Nach Profil-Save | Header/Form stale bis Refetch | **sofort** via TanStack `setQueryData` |
| Avatar → Einstellungen | `_rsc` Prefetch | **0×** (`prefetch={false}`) |

Checkliste: [`scripts/perf/einstellungen-netlify-log-checklist.md`](../scripts/perf/einstellungen-netlify-log-checklist.md)

| Aktion | Function-Invocations |
|--------|---------------------|
| Hard reload `/einstellungen` | **1×** (SSR Bootstrap) |
| Profil speichern | **1×** `saveProfileSettingsAction` |

---

## Phase BF — Bestellformulare Hybrid-SSR (Prod-Baseline)

| Metrik | Vorher (Phase B) | Ziel |
|--------|------------------|------|
| Document GET `/bestellformulare` | Shell + Spinner + POST | Templates im dehydrated JSON |
| POST `/bestellformulare` nach Load | **1×** `listOrderFormTemplatesForOrgAction` | **0×** |
| CMS Save/Create/Delete | **2×** POST (mutation + refetch) | **1×** (`setQueryData` + Realtime publish) |
| Cross-Tab Template-Sync | stale | Realtime `order_form_template.changed` |

Checkliste: [`scripts/perf/bestellformulare-netlify-log-checklist.md`](../scripts/perf/bestellformulare-netlify-log-checklist.md)

| Aktion | Function-Invocations |
|--------|---------------------|
| Hard reload `/bestellformulare` | **1×** (SSR Bootstrap) |
| Template erstellen/speichern/löschen | **1×** pro Aktion |

---

## Phase Tag — Mein Tag Hybrid-SSR (Prod-Baseline)

| Metrik | Vorher (Phase B) | Ziel |
|--------|------------------|------|
| Document GET `/tag` | Shell + Spinner-Gap | Week-Tasks im dehydrated JSON |
| POST `/tag` nach Load | **1×** `fetchWeekTasksAction` (~800 ms) | **0×** |
| Profil-POST | **0** (Layout) | **0** |
| Bottom-Nav `_rsc` Prefetch | `/wochenplan` + `/profil` je 2× | **0×** (`prefetch={false}`) |
| Auftrag-Karten `_rsc` Prefetch | viele `GET /auftrag/*?_rsc=` | **0×** (`TechAuftragLink`) |
| Realtime | `appointment.changed` → `weekTasks` invalidate | unverändert |

Checkliste: [`scripts/perf/tag-netlify-log-checklist.md`](../scripts/perf/tag-netlify-log-checklist.md)

| Aktion | Function-Invocations |
|--------|---------------------|
| Hard reload `/tag` | **1×** (SSR Bootstrap + `calendar_range_tasks_for_org`) |
| Rapport speichern auf `/auftrag` | Realtime invalidiert Cache; optional Refetch |

Shared Query-Key `weekTasks.byDate(refIso)` — `/wochenplan` profitiert beim ersten Besuch derselben Woche.

---

## Phase Wochenplan — Kalender Hybrid-SSR (Prod-Baseline)

| Metrik | Vorher (Phase B) | Ziel |
|--------|------------------|------|
| Document GET `/wochenplan` | Shell + Client-Fetch | Week im dehydrated JSON (Month nur bei `?view=month`) |
| POST `/wochenplan` nach Load (view=day) | **1×** Week (+ Month bei Tab) | **0×** |
| Monats-Tab ohne `?view=month` | — | **1×** POST (erwartet) |
| Monats-Load `?view=month` | POST `fetchTechMonthTasksAction` | **0×** (SSR seeded) |
| Anderer Monat (Pfeil) | POST | **1×** (erwartet) |

Checkliste: [`scripts/perf/wochenplan-netlify-log-checklist.md`](../scripts/perf/wochenplan-netlify-log-checklist.md)

| Aktion | Function-Invocations |
|--------|---------------------|
| Hard reload `/wochenplan` | **1×** (SSR Bootstrap, Week-RPC; +Month nur bei `?view=month`) |
| Monats-Tab ohne URL-Wechsel | **1×** POST (Month defer) |
| Load mit `?view=month` | **0×** POST Month |
| Monat vor/zurück | **1×** pro neuem Monat |

---

## Phase Auftrag — Extras defer (Prod-Baseline)

| Metrik | Vorher | Ziel |
|--------|--------|------|
| Document GET `/auftrag/[id]` | `getProjectCore` + sign URLs + Templates | **nur** `getProjectCore` + Guard |
| POST nach Load | 0 | **1×** `fetchAuftragExtrasAction` (signierte URLs + Templates) |
| TTFB | blockiert auf Storage | schneller; Galerie/Form kurz «lädt» |

| Aktion | Function-Invocations |
|--------|---------------------|
| Hard reload `/auftrag/[id]` | **1×** Document + **1×** Extras POST |
| Rapport speichern | Realtime `project.core_changed` (kein `revalidatePath`) |

---

## Phase Kal-Sheet — Lazy Editor

| Massnahme | Wirkung |
|-----------|---------|
| `ProjektSheetEditor` per `dynamic()` in `kalender-project-sheet.tsx` | Kleineres initiales JS auf `/kalender` |
| `useProjectCore` `refetchOnMount: false` | Kein doppelter head+details POST nach Hover-Prefetch |

---

## Phase Kal-DB — Calendar Range RPC (kein UI-Change)

| Massnahme | Wirkung |
|-----------|---------|
| RPC `calendar_range_tasks_for_org` | Termine + Projekt + Monteur in **1 DB-Roundtrip** statt 2 PostgREST-Calls |
| Fallback bei RPC-Fehler | Bestehende `weekTasksFromAppointmentRange`-Query |

Migration: [`20260626200000_perf_calendar_range_rpc.sql`](supabase/migrations/20260626200000_perf_calendar_range_rpc.sql)

| Metrik | Vor Kal-DB | Ziel |
|--------|------------|------|
| DB Roundtrips Kalender-Load | 2 (appointments+projects, profiles) | **1** |
| `slow_operation` weekTasks | 843–1467 ms | **~500–700 ms** (org-abhängig) |
| TTFB Document | ~409 ms | **~280–350 ms** |

Verifikation:

```bash
psql "$DATABASE_URL" -f scripts/perf/verify-calendar-range-rpc.sql
psql "$DATABASE_URL" -f scripts/perf/explain-top-queries.sql
```

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

## Phase Interaction — Termin buchen + Auftrag Rapport

**Ziel:** Weniger Server-Action-POSTs bei wiederholten UI-Interaktionen (nicht nur Erstladung).

### Aufnahme (3-Minuten-Session)

Siehe [`scripts/perf/projekte-interaction-checklist.md`](../scripts/perf/projekte-interaction-checklist.md).

1. Neues Projekt / Sheet öffnen, 2 Termine buchen (Datum tweaken), PDF ansehen
2. Kalender → Tag → zurück Projekte (soft-nav)
3. Auftrag öffnen: Rapport + 2 Fotos hochladen

```bash
node scripts/perf/summarize-har.mjs ~/Desktop/app.gross-storenbau.ch.har
```

### Gates (nach Fix-Deploy)

| Session | Metrik | Vorher (Prod-HAR) | Ziel |
|---------|--------|-------------------|------|
| Termin buchen | POST `/projekte` gesamt | 20 | **≤ 8** |
| Termin buchen | `availability` POSTs | ~12 | **≤ 3** |
| Auftrag Rapport+Fotos | POST `/auftrag` | 7 | **≤ 4** (ohne core refetch) |
| Sheet öffnen | `getProjectCore` slow_operation | ~907 ms | ≤ 600 ms (`loadProjectCoreBootstrap`, PR-I) |

`summarize-har.mjs` klassifiziert POST `/projekte` nach Body-Heuristik (`availability`, `list`, `mutation`, `core`) — nicht alles ist Bootstrap.

HAR ohne Document-GET `/projekte` (Capture nach Redirect): Timeline nutzt ersten POST statt Document-Ende.

### Umgesetzt

| Massnahme | Dateien |
|-----------|---------|
| Upload liefert signierten Anhang + Cache-Patch | [`app/(app)/actions.ts`](../app/(app)/actions.ts), [`lib/query/hooks.ts`](../lib/query/hooks.ts), [`lib/query/invalidations.ts`](../lib/query/invalidations.ts) |
| Auftrag extras-Merge + invalidation | [`components/app/monteur-auftrag-client.tsx`](../components/app/monteur-auftrag-client.tsx) |
| `openProjectId` aus URL beim Sheet-Öffnen | [`components/app/projekte-list-client.tsx`](../components/app/projekte-list-client.tsx) |
| Availability: Debounce + ein Query + Tag-Keys | [`components/app/appointment-booking-form.tsx`](../components/app/appointment-booking-form.tsx), [`lib/query/availability-range-bounds.ts`](../lib/query/availability-range-bounds.ts) |
| HAR-Klassifikation + Gates | [`scripts/perf/summarize-har.mjs`](../scripts/perf/summarize-har.mjs) |

---

## Tier 1 — Sheet RPC + cold start (PR-I, 2026-06-23)

### Part A — `project_core_bootstrap` (code shipped)

| Massnahme | Dateien |
|-----------|---------|
| RPC `project_core_bootstrap` | [`20260701120000_perf_project_core_bootstrap_rpc.sql`](supabase/migrations/20260701120000_perf_project_core_bootstrap_rpc.sql) |
| Verify SQL | [`scripts/perf/verify-project-core-bootstrap-rpc.sql`](scripts/perf/verify-project-core-bootstrap-rpc.sql) |
| Loader + PostgREST fallback | [`loadProjectCoreBootstrap`](lib/db/repository.ts) |
| Single sheet action | [`getProjectSheetBootstrapAction`](app/(app)/projekte/actions.ts) |
| `useProjectCore` → 1× query | [`lib/query/hooks.ts`](lib/query/hooks.ts) |
| Hover prefetch full core | [`lib/query/prefetch-project-core.ts`](lib/query/prefetch-project-core.ts) |
| HAR classifies bootstrap action | [`scripts/perf/summarize-har.mjs`](scripts/perf/summarize-har.mjs) |

**Vor PR-I (Sheet open):**

| Metrik | Wert |
|--------|------|
| Server Actions | **2×** (`getProjectSheetHeadAction` → `getProjectSheetDetailsAction`) |
| `slow_operation` | `getProjectCoreHead` + `getProjectCoreDetails`, **900 ms–2.7 s** |
| Kalender sheet | Gleiches 2× `core` POST-Muster |

**Ziel nach Deploy + `db:push`:**

| Metrik | Ziel |
|--------|------|
| Sheet open `core` POSTs | **1×** (`getProjectSheetBootstrapAction`) |
| `slow_operation` | `loadProjectCoreBootstrap` **≤ 600 ms** typisch (+ `signAttachmentUrls`) |
| Fallback | PostgREST head+details wenn RPC fehlt/fehlschlägt |

**Deploy-Schritte:**

```bash
# 1. Migration anwenden (nach expliziter Freigabe)
npm run db:push

# 2. RPC verifizieren
psql "$DATABASE_URL" -f scripts/perf/verify-project-core-bootstrap-rpc.sql

# 3. Build (lokal grün 2026-06-23)
npm run typecheck && npm run build
```

**HAR nach Deploy:**

```bash
# Projekte: Zeile klicken → Sheet → schliessen (3×)
# Kalender: Termin → Sheet → schliessen (3×)
node scripts/perf/summarize-har.mjs ~/sheet-open.har
# Erwartung: 1× core POST pro Sheet-Öffnung (nicht 2×)
```

Head/Details-Actions bleiben als Fallback; nicht entfernen bis Prod-Logs stabil.

### Part B — Cold start (Ops, kein Code)

Checkliste in [`docs/netlify-compute-optimization.md`](netlify-compute-optimization.md#cold-start-checklist-tier-1--ops):

| Step | Aktion |
|------|--------|
| B1 | Netlify Functions-Region = Supabase-Region (z. B. EU) |
| B2 | Server-DB-URL: Transaction Pooler (Port **6543**) |
| B3 | `SERVER_ACTION_SLOW_MS=800` auf Netlify |
| B4 | Optional: Warmup `GET /projekte` alle 5–10 min |
| B5 | 2× Hard Reload — 1. vs 2. TTFB dokumentieren |

**Baseline (bestehend):** Unauth Redirect Run 1 ~1,7 s TTFB (cold), Run 2 ~244 ms (warm). Prod Document cold ~4,8 s Function-Log dokumentiert.

---

## Post-Audit Prod (2026-06-23)

Full audit after Tier-1 deploy + MCP verification (Supabase + Netlify).

### Session A — Sheet-only HAR (morning)

| Gate | Target | Result |
|------|--------|--------|
| `/projekte` Bootstrap POST | 0× | **0×** (Hybrid-SSR) |
| Document TTFB | warm | ~529 ms |
| RSC content | ~50 rows | ~325 KB |
| `/api/events` | 0× | **0×** |
| Sheet `core` POSTs (3 opens) | 1× each | **3×** (PR-I PASS) |
| head→details burst | none &lt;300 ms | **PASS** |
| Kalender early POST | 0× &lt;500 ms | **PASS** |

```bash
node scripts/perf/summarize-har.mjs ~/Desktop/app.gross-storenbau.ch.har
# → Sheet gates (PR-I) PASS
```

Checklist: [`scripts/perf/sheet-open-checklist.md`](../scripts/perf/sheet-open-checklist.md)

### Session B — Long prod session (~16:23–16:28, polluted HAR)

Same day, ~2,7 min DevTools capture with extensions (Grammarly, HubSpot inject). **123 app entries** after HAR filter (299 raw with extension noise).

```bash
node scripts/perf/summarize-har.mjs ~/Desktop/app.gross-storenbau.ch.har
```

| Gate | Target | Result |
|------|--------|--------|
| Document `/projekte` | — | 2225 ms, TTFB **726 ms**, RSC **327 KB** |
| Bootstrap POST after document | 0× | **PASS** |
| Sheet PR-I `core` POSTs | 1× per open | **4×** (3 projects + duplicate open) **PASS** |
| head→details burst | none &lt;300 ms | **PASS** |
| Availability POSTs | ≤ 3 | **2×** **PASS** |
| Interaction POST `/projekte` total | ≤ 8 | **12×** **FAIL** (polluted session) |
| WebSocket | 1× typical | **6×** (long nav + reconnects) |
| Sidebar `_rsc` prefetches | — | **12×** (active nav, not Link prefetch) |

**POST `/projekte` breakdown (why interaction FAIL):**

| Typ | Anzahl | Ursache |
|-----|--------|---------|
| `core` | 4 | 3 Projekte geöffnet (`ad15…`, `a4ea…`, `b4bde…` 2×) |
| `list` | 2 | Status-Refetch `["active",""]` |
| `availability` | 2 | Slot-Tweaks (ok) |
| `mutation` | 1 | Termin buchen (ok) |
| `upload` | 1 | Multipart |
| `other` | 2 | Assignable-Profiles `[]` + Form-Multipart |

Zusätzlich: Suche `?q=test`, Navigation tag → wochenplan → kalender → auftrag. **Kein Architektur-Regression** — für Interaction-Gate: [`termin-buchen-clean-har.md`](../scripts/perf/termin-buchen-clean-har.md).

**Netlify function logs (Session B, duration view):**

| Observation | Value |
|---------------|-------|
| Cold burst (16:23:22) | **1663–1793 ms** |
| Steady state | meist **400–700 ms** (besser als frühere ~2 s) |
| Ausreißer | **1070 ms**, **1403 ms**, **1644 ms** |
| Memory | **194–218 MB** |
| `realtime publish failed: AbortError` | 1× WARN (16:24:33) — fire-and-forget `httpSend` abgebrochen wenn Function endet; Fix: `await publish()` (Code, noch nicht deployed) |

**DevTools-Rohdaten (nicht für Gates):** 299 requests, 13,9 MB, Finish 2,7 min, **193 Console-Errors** (überwiegend Extensions). Incognito ohne Extensions verwenden.

### Netlify function logs (Session A reference)

| Observation | Value |
|---------------|-------|
| Cold burst | ~2,4–2,6 s (4 parallel invocations) |
| `loadProjectCoreBootstrap` slow | **834 ms**, **2056 ms** (threshold 800 ms) |
| Faster opens | ~555–602 ms |
| `SERVER_ACTION_SLOW_MS` | **800** (confirmed on site `bauflipp`) |

After deploy `6a3a95a` (2026-06-23 ~14:18 UTC): separate `signAttachmentUrls` in slow logs (`attachmentCount` meta). Session B duration-only logs showed no `slow_operation` lines — see [`verify-signAttachmentUrls-netlify.md`](../scripts/perf/verify-signAttachmentUrls-netlify.md).

**Current production deploy (MCP, 2026-06-23):**

| Field | Value |
|-------|-------|
| Deploy ID | `6a3a95a056a80900088867fb` |
| Commit | `b513c72` — Post-audit perf (HAR gates, signAttachmentUrls slow_log, FK index migration) |
| Functions region | **`fra` / `eu-central-1`** (Pro, verified 2026-06-23 deploy `6a3a9d8a`) |
| Pending after this doc | `await publish()` realtime fix, clean interaction HAR |

### Post-Audit DB — `project_core_bootstrap` EXPLAIN

SQL Editor (`EXPLAIN ANALYZE`), service context — **not** identical to RLS + Netlify path:

| Project | Data (appts/atts/reports) | Execution time |
|---------|---------------------------|----------------|
| `8fb56af5-…` | 1 / 1 / 2 | ~**83 ms** |
| `c616a555-…` | 3 / 3 / 2 | ~**9 ms** (cached) |

**Conclusion:** RPC SQL is fast; prod **834–2056 ms** `loadProjectCoreBootstrap` is dominated by **Netlify cold/warm**, PostgREST hop, RLS, and signing — not missing indexes on sheet FKs.

### Post-Frankfurt smoke (2026-06-23, curl von Dev-Machine)

| Endpoint | TTFB (warm) | Hinweis |
|----------|-------------|---------|
| `/anmeldung` | **~160–630 ms** (Run 5: 161 ms) | Edge/Durable Cache hit möglich |
| `/anmeldung` (1. Run) | **~1,0 s** | Cold-ish nach Pause |
| `/projekte` (ohne Cookie) | **~210–280 ms** | 307 → `/anmeldung` |

**Authentifizierter Document-Test:** Incognito einloggen → 2× Hard Reload `/projekte` → HAR oder DevTools TTFB mit [`termin-buchen-clean-har.md`](../scripts/perf/termin-buchen-clean-har.md) vergleichen (Ziel Document &lt; ~1,5 s warm).

---

### Ops still open

| Item | Action |
|------|--------|
| Region match | **Done** — `fra` / `eu-central-1` (2026-06-23) |
| Warmup | Optional — [`scripts/perf/warmup-options.md`](../scripts/perf/warmup-options.md) |
| Duplicate FK indexes | Migration ready — `20260723140000_perf_drop_duplicate_fk_indexes.sql` (**await `db:push`**) |
| Interaction HAR Termin buchen | Clean capture — [`termin-buchen-clean-har.md`](../scripts/perf/termin-buchen-clean-har.md) |
| Realtime AbortError on Netlify | `await publish()` in [`lib/realtime/publish.ts`](../lib/realtime/publish.ts) — deploy after merge |

### Phase 2b list slim

Already shipped: `PROJECT_LIST_COLUMNS` = `id, title, type, status, tenant_name, created_at`. RSC ~325 KB is meta + status counts + TanStack dehydration — no further UI change in this pass.

---

## Nächste Schritte (optional, Phase B)

- `npm run analyze` für Listen-Chunk-Grösse
- Hybrid-SSR Bootstrap nur wenn Preview-HAR Hydration-Gap > 500 ms zeigt
- Bei >500 Projekten: serverseitiger Status-Filter / Pagination
