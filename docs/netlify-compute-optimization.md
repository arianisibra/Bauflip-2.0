# Netlify Compute: Auth- und Rendering-Optimierung

Stand: 2026-05-26 (Phase C)

## Ziel

Weniger Serverless-Compute pro Request ohne Security-Einbussen. Geschützte App-Routen bleiben dynamisch (`ƒ`); öffentliche Shells werden statisch (`○`).

## Phase C — Auth-Deduplizierung & Session-Profil (neu)

| Massnahme | Dateien |
|-----------|---------|
| Mutationen: `requireOfficeSession` / `requireOrgLayoutSession` / `requireTechFieldSession` / `requireAdminLayoutSession` statt `getCurrentSession` | [`app/(app)/projekte/actions.ts`](app/(app)/projekte/actions.ts), [`app/(app)/actions.ts`](app/(app)/actions.ts), [`app/(tech)/actions.ts`](app/(tech)/actions.ts), … |
| Session-Profil einmal im Layout (`getCachedSessionProfile` + `SessionProfileProvider`) | [`lib/auth/session.ts`](lib/auth/session.ts), [`components/app/session-profile-provider.tsx`](components/app/session-profile-provider.tsx), App/Tech-Layouts |
| Kein `fetchSessionProfileAction`-POST auf Tag/Wochenplan/Profil/Mitarbeiter/Bestellformulare | Client-Pages nutzen `useSessionProfile()` |
| RSC-Admin-Guard | [`app/(app)/mitarbeiter/page.tsx`](app/(app)/mitarbeiter/page.tsx), [`app/(app)/bestellformulare/page.tsx`](app/(app)/bestellformulare/page.tsx) |
| `/auftrag/[projectId]`: `getLayoutSession` statt voller Session | [`app/(tech)/auftrag/[projectId]/page.tsx`](app/(tech)/auftrag/[projectId]/page.tsx) |
| Proxy metadata fast-path (`role` + `organization_id` in `user_metadata`) | [`lib/auth/user-metadata-keys.ts`](lib/auth/user-metadata-keys.ts), [`proxy.ts`](proxy.ts), [`scripts/sync-user-auth-metadata.mts`](scripts/sync-user-auth-metadata.mts) |
| `/projekte` serverseitiger Status-Filter | [`lib/db/repository.ts`](lib/db/repository.ts), [`useProjekteBootstrap(status)`](lib/query/hooks.ts) |

**`getCurrentSession()` bleibt nur für:** Einstellungen (Avatar/Profil speichern), `getCurrentRole`/`getCurrentProfile`.

**Nach Deploy (einmalig):** `npx tsx --env-file=.env.local scripts/sync-user-auth-metadata.mts` — backfillt `user_metadata.organization_id` für bestehende User.

## Build-Vergleich (Route-Tabelle)

### Vorher (Baseline)

| Symbol | Routen |
|--------|--------|
| ○ Static | `/_not-found`, `/anmeldung`, `/onboarding`, `/tech` |
| ƒ Dynamic | `/`, `/auftrag/[projectId]`, `/bestellformulare`, … (kein `/api/events` mehr) |

### Nachher

| Symbol | Routen |
|--------|--------|
| ○ Static | `/_not-found`, `/anmeldung`, `/onboarding`, `/tech` |
| ƒ Dynamic | alle geschützten App-/Tech-Routen (unverändert im Build-Output) |

**Erwartung erfüllt:** Öffentliche Auth-Shells bleiben statisch. App-Bereiche bleiben `ƒ`, aber mit deutlich weniger Arbeit pro Invocation (siehe Massnahmen).

## Umgesetzte Massnahmen

### Phase A — Proxy & Layout

- **Public fast-path** (`proxy.ts`): Kein `getUser()` auf `/anmeldung`, `/onboarding`, `/mfa/setup` ohne Auth-Cookie.
- **Engerer Matcher**: Manifest, Icons, gängige Static-Extensions ausgeschlossen.
- **Proxy-Header**: `x-bauflip-proxy-auth-user-id`, `x-bauflip-proxy-role`, `x-bauflip-proxy-org-id`.
- **`getLayoutSession()`**: Schlankes Layout-API ohne Profile-DB/Membership-Query wenn Proxy-Header passen.
- **App/Tech Layouts**: `getLayoutSession()` statt `getCurrentSession()`.
- **Branding**: Client-seitig via `OrganizationBrandingHeader` + `fetchOrganizationBrandingAction`.
- **MFA**: Nur für `role === 'admin'` im App-Layout.

### Phase B — Client-Data-First Pages

| Route | Vorher (SSR) | Nachher |
|-------|--------------|---------|
| `/projekte` | Session + Projekte + Techniker | Shell + `useProjectsList` / `useAssignableProfiles` |
| `/kalender` | Session + Monatsdaten | Shell + `AdminCalendar` client fetch |
| `/tag`, `/wochenplan` | Session + Wochenaufgaben | Shell + `useWeekTasks` client fetch |
| `/mitarbeiter` | Session + Team + Abwesenheiten | Shell + `useTeamMembers` / `useAbsences` |
| `/bestellformulare` | Session + Templates | Shell + `listOrderFormTemplatesForOrgAction` |
| `/einstellungen` | Session + Profil + Org | Shell + `fetchEinstellungenPageDataAction` |
| `/profil` (Tech) | Session | Shell + `fetchSessionProfileAction` |

**Bewusst SSR behalten:** `/auftrag/[projectId]` (First Paint mit Projektdaten).

### Phase B — Redundantes `getCurrentSession` in Mutationen entfernt (Phase C)

Cross-Tab-Sync läuft über **Supabase Realtime Broadcast** ([`lib/realtime/publish.ts`](lib/realtime/publish.ts), [`lib/query/realtime-bridge.tsx`](lib/query/realtime-bridge.tsx)) — kein offener Netlify-Stream mehr.

## Verifikation

- `npm run typecheck` — grün
- `npm run build` — grün
- **Manuell:** Login, Monteur-Guard, Admin-MFA, `/projekte` (1× Bootstrap-POST), `/tag` (0× Profil-POST), Cross-Tab Realtime
- **Netlify:** Kein `/api/events`; optional `SERVER_ACTION_SLOW_MS=800`
- **Prod einmalig:** `scripts/sync-user-auth-metadata.mts` + RPC [`20260622140000_perf_next_appointment_rpc.sql`](supabase/migrations/20260622140000_perf_next_appointment_rpc.sql)

## Nicht geändert (Security)

- Proxy-Auth auf geschützten Routen
- `getCurrentSession()` für Profil-Mutationen (Einstellungen)
- Admin-MFA im App-Layout
- Kein `force-static` auf `(app)` / `(tech)`

## Cold start checklist (Tier 1 — Ops)

First request after idle can hit **~4–5 s** Netlify cold start (documented in [`performance-production-har.md`](performance-production-har.md)). Warm reloads are ~800 ms — optimize cold separately from app logic.

| Step | Action | Where |
|------|--------|-------|
| B1 | Netlify Functions region **matches** Supabase region (e.g. EU) | Netlify Site settings → Functions |
| B2 | Server DB uses **transaction pooler** (port **6543**) | Supabase Dashboard → Database → Connection string |
| B3 | `SERVER_ACTION_SLOW_MS=800` in Netlify env | Site → Environment variables |
| B4 | Optional: scheduled warmup | See [`scripts/perf/warmup-options.md`](../scripts/perf/warmup-options.md) (UptimeRobot → `/anmeldung`) |
| B5 | Baseline: hard reload 2× — compare 1st vs 2nd document TTFB | HAR or DevTools; log in `performance-production-har.md` |

### Region verification (manual)

Netlify MCP does **not** expose Functions region — verify in dashboards:

| Service | Path | Target |
|---------|------|--------|
| **Netlify** site `bauflipp` | [Project configuration → Functions](https://app.netlify.com/projects/bauflipp) | EU (e.g. `eu-central-1`) |
| **Supabase** `pgcxmfkfvwhnbuqwzysc` | Project Settings → General → Region | EU (e.g. Frankfurt / `eu-central-1`) |

**Verifiziert am:** ___

Agent playbook: [`.agents/skills/bauflip-performance/massive-perf-roadmap.md`](../.agents/skills/bauflip-performance/massive-perf-roadmap.md) and [`netlify-auth-compute.md`](../.agents/skills/bauflip-performance/netlify-auth-compute.md).

**No app code required** for B1–B3. B4 only if cold remains painful after region + pooler.
