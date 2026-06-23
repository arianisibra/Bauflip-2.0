# Netlify auth and compute

Deep dive doc: [`docs/netlify-compute-optimization.md`](../../../docs/netlify-compute-optimization.md)

## Why routes are dynamic (`ƒ`)

Any Server Component calling `cookies()` or `headers()` is **dynamic** in Next.js. Bauflip's authenticated layouts do this by design. Goal is not force-static on office routes — it is **less work per invocation**.

---

## Phase A — Proxy and layout

| Measure | Files |
|---------|-------|
| Public fast-path: no `getUser()` without auth cookie | `proxy.ts` |
| Tighter matcher (exclude static assets) | `proxy.ts` |
| Proxy headers: `x-bauflip-proxy-auth-user-id`, `x-bauflip-proxy-role`, `x-bauflip-proxy-org-id` | `proxy.ts` |
| `getLayoutSession()` — slim layout API | `lib/auth/session.ts` |
| App/Tech layouts use layout session | `app/(app)/layout.tsx`, `app/(tech)/layout.tsx` |
| Branding client-side | `OrganizationBrandingHeader` |
| MFA check admin-only | App layout |

---

## Phase B — Client-data-first (historical)

Initially moved heavy reads to client hooks after shell RSC. **Hybrid-SSR superseded this** on `/projekte`, `/kalender`, `/mitarbeiter`, `/tag`, `/wochenplan`, `/einstellungen`, `/bestellformulare`.

**Still SSR by design:** `/auftrag/[projectId]` — fast first paint with project core.

---

## Phase C — Session deduplication

| Measure | Effect |
|---------|--------|
| `requireOfficeSession` / `requireOrgLayoutSession` / `requireTechFieldSession` in mutations | No full `getCurrentSession` + membership DB per action |
| `SessionProfileProvider` + `getCachedSessionProfile` in layout | **0×** `fetchSessionProfileAction` on tag/wochenplan/profil/etc. |
| `getCurrentSession()` only for profile save, avatar, settings writes | Documented exceptions |
| Proxy metadata fast-path (`user_metadata.organization_id`, role) | Skip membership query when metadata present |
| Server-side status filter on `/projekte` | `.eq(status)` in repository |

**One-time after deploy:**

```bash
npx tsx --env-file=.env.local scripts/sync-user-auth-metadata.mts
```

Files: `lib/auth/user-metadata-keys.ts`, `scripts/sync-user-auth-metadata.mts`

---

## Realtime migration (SSE removal)

### Problem

`GET /api/events` held Netlify functions ~**60 seconds** per tab → ~60 invocations/hour/tab with no user activity.

### Solution

| Component | Role |
|-----------|------|
| `lib/realtime/publish.ts` | Publish events after mutations |
| `lib/query/realtime-bridge.tsx` | Subscribe; invalidate TanStack queries |
| `lib/realtime/connect-routes.ts` | Connect only on data routes |
| `components/app/authenticated-realtime.tsx` | Wrapper in layouts |

**Verify after deploy:** Netlify observability shows **0** `/api/events`; no `Duration: 60000 ms` SSE loops.

`afterAppointmentChange` (realtime) still uses **broad** invalidation when appointment window is unknown — PR-G scoped invalidation is for **client mutations** with known window.

---

## Slow operation logging

**Env (Netlify + `.env.local`):**

```
SERVER_ACTION_SLOW_MS=800
```

Implementation: [`lib/observability/slow-log.ts`](../../../lib/observability/slow-log.ts) — JSON on stderr when repository/actions exceed threshold.

Common slow paths in logs:

| Operation | Typical duration | Notes |
|-----------|------------------|-------|
| `weekTasksFromAppointmentRange` | 500–1500 ms | Kal-DB RPC reduces roundtrips |
| `getProjectCore` | 500–900 ms | 1× per sheet open |
| `listProjectsForOfficePage` | varies | trgm search + pagination |
| Cold layout invocation | up to ~5 s | Netlify cold start |

---

## Function invocation budgets (by user action)

| Action | Expected invocations |
|--------|---------------------|
| Hard reload `/projekte` (Hybrid-SSR) | **1×** RSC |
| Hard reload `/kalender` | **1×** RSC + optional 1× `weekTasks` in SSR |
| Open project sheet | **1×** `getProjectCore` POST |
| Close sheet | **0×** |
| Book appointment (client mutation) | **1×** + scoped invalidation (PR-G) |
| Tab hidden | Realtime disconnect — fewer background refetches |

See per-route matrices in [`docs/performance-production-har.md`](../../../docs/performance-production-har.md).

---

## Infrastructure

- Align **Netlify region** with **Supabase region**.
- Use **transaction pooler** for serverless (see `.env.example`).
- Protected routes remain `ƒ` in build output — expected.

---

## Auth helpers (PR-C)

Shared modules:

- [`lib/auth/map-role.ts`](../../../lib/auth/map-role.ts) — `mapRole`
- [`lib/auth/cookies.ts`](../../../lib/auth/cookies.ts) — `hasSupabaseAuthCookie`

Used in `proxy.ts`, `lib/auth/session.ts`, `lib/supabase/server.ts`.

---

## Debugging checklist

1. Filter Netlify logs: `slow_operation`, `weekTasksFromAppointmentRange`, `getProjectCore`
2. Confirm no `/api/events`
3. Count POSTs after document with `summarize-har.mjs`
4. Check for `_rsc` prefetch storms → `prefetch={false}` on sidebar, bottom nav, `TechAuftragLink`
5. Compare warm vs cold — don't optimize for cold start unless it's the reported pain
