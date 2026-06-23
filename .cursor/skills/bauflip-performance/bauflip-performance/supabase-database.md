# Supabase database performance

When HAR shows few POSTs but long Server Action duration or `slow_operation` in logs → profile SQL first.

Also read: [supabase-postgres-best-practices](../supabase-postgres-best-practices/SKILL.md)

**Rule:** DB migrations require **explicit user approval**. Never auto-apply.

---

## Shipped performance RPCs

| RPC | Migration | Repository / caller | Saves |
|-----|-----------|---------------------|-------|
| `next_appointment_starts_for_org` | [`20260622140000_perf_next_appointment_rpc.sql`](../../../supabase/migrations/20260622140000_perf_next_appointment_rpc.sql) | `attachNextAppointmentsForProjects` | Org-wide next-appt map; index `idx_appointments_ends_at` |
| `project_status_counts_for_org` | [`20260622190000_perf_status_counts_search_trgm.sql`](../../../supabase/migrations/20260622190000_perf_status_counts_search_trgm.sql) | status count paths | `GROUP BY status` vs full scan |
| `projekte_office_bootstrap` | [`20260626120000_perf_projekte_office_bootstrap_rpc.sql`](../../../supabase/migrations/20260626120000_perf_projekte_office_bootstrap_rpc.sql) | `loadProjekteBootstrapData` | Page 1 + counts in **1** roundtrip |
| `calendar_range_tasks_for_org` | [`20260626200000_perf_calendar_range_rpc.sql`](../../../supabase/migrations/20260626200000_perf_calendar_range_rpc.sql) | `weekTasksFromAppointmentRange` | Appointments + project + tech in **1** call |
| `mitarbeiter_office_bootstrap` | [`20260627120000_perf_mitarbeiter_bootstrap_rpc.sql`](../../../supabase/migrations/20260627120000_perf_mitarbeiter_bootstrap_rpc.sql) | mitarbeiter server bootstrap | Team + absences in **1** call |
| `project_core_bootstrap` | [`20260701120000_perf_project_core_bootstrap_rpc.sql`](../../../supabase/migrations/20260701120000_perf_project_core_bootstrap_rpc.sql) | `loadProjectCoreBootstrap` | Project + appointments + attachments + reports in **1** call (PR-I, prod verified 2026-06-23) |

### Index hygiene (post-audit)

| Migration | Action |
|-----------|--------|
| [`20260723140000_perf_drop_duplicate_fk_indexes.sql`](../../../supabase/migrations/20260723140000_perf_drop_duplicate_fk_indexes.sql) | Drop redundant `*_project_id_fkey_idx` on `project_attachments`, `technician_reports` (keep `idx_*_project_id`) |

Verify: [`scripts/perf/verify-drop-duplicate-fk-indexes.sql`](../../../scripts/perf/verify-drop-duplicate-fk-indexes.sql) — **await `db:push`**

**PR-I latency note:** `EXPLAIN ANALYZE` on `project_core_bootstrap` is ~9–83 ms in SQL Editor; prod `slow_operation` 834–2056 ms is Netlify + RLS + signing path, not missing sheet FK indexes.

### `projekte_office_bootstrap` notes

- Partial index: `idx_projects_org_created_active` (`status <> 'abgeschlossen'`)
- Fallback: parallel PostgREST queries on RPC error or `abgemacht` filter paths
- Dev log: `listMeta.rpc` = `projekte_office_bootstrap` on default load

### `calendar_range_tasks_for_org` notes

- Returns JSON array of tasks with project + technician fields
- Fallback: existing `weekTasksFromAppointmentRange` PostgREST path
- Log `calendar_range_rpc_fallback` on failure

### `mitarbeiter_office_bootstrap` notes

- `security definer` with explicit org guard (`current_organization_id()`)
- Joins `auth.users` for email — reason for definer

### `next_appointment_starts_for_org` notes

- Only invoked when filter needs appointment sort (`abgemacht`)
- `distinct on (project_id)` ordered by `starts_at`

---

## Indexes

| Index | Migration | Purpose |
|-------|-----------|---------|
| `idx_appointments_ends_at` | next_appointment RPC | `ends_at >= now()` filter |
| `idx_appointments_starts_at` | calendar (verify script) | Range scans |
| `idx_projects_org_created_active` | projekte bootstrap | Default active list |
| `idx_projects_*_trgm` (GIN) | status_counts migration | Server `ilike` search on title, tenant, address fields, reference |

Extension: `pg_trgm` in `extensions` schema.

When adding new searchable project text fields → add matching trgm index.

---

## Verification workflow

After migration (with user approval):

```bash
psql "$DATABASE_URL" -f scripts/perf/verify-projekte-bootstrap-rpc.sql
psql "$DATABASE_URL" -f scripts/perf/verify-calendar-range-rpc.sql
psql "$DATABASE_URL" -f scripts/perf/verify-mitarbeiter-bootstrap-rpc.sql
psql "$DATABASE_URL" -f scripts/perf/verify-next-appointment-rpc.sql
psql "$DATABASE_URL" -f scripts/perf/verify-status-counts-rpc.sql
psql "$DATABASE_URL" -f scripts/perf/verify-project-core-bootstrap-rpc.sql
psql "$DATABASE_URL" -f scripts/perf/verify-drop-duplicate-fk-indexes.sql
psql "$DATABASE_URL" -f scripts/perf/explain-top-queries.sql
```

Deploy migration **before** production code depends on RPC.

---

## RPC design conventions (Bauflip)

| Rule | Detail |
|------|--------|
| Security | `security invoker` default; `definer` only with org guard + `auth` schema need |
| Volatility | `stable` for read RPCs |
| search_path | `set search_path = public` or `public, auth` |
| Returns | `jsonb` for composite bootstrap; `returns table` for narrow maps |
| Grants | `grant execute ... to authenticated` on every RPC |
| App pattern | `supabase.rpc()` → parse → on error log + **PostgREST fallback** |

Example repository pattern (calendar):

```typescript
const { data, error } = await supabase.rpc("calendar_range_tasks_for_org", { … });
if (error) {
  console.warn("[bauflip] calendar_range_rpc_fallback", error);
  return legacyWeekTasksFromAppointmentRange(…);
}
```

---

## Known slow paths (PostgREST — backlog)

| Path | Symptom | Deferred fix |
|------|---------|--------------|
| `getProjectCore` | 1–2.7s on sheet (pre PR-I) | **PR-I:** `loadProjectCoreBootstrap` + RPC (fallback PostgREST) |
| `listAvailabilityForRange` | Heavy booking; at 3 POST gate | `availability_range_for_org` |
| `listTeamMembersForOrg` email | N× `getUserById` before RPC | mitarbeiter RPC (shipped) or profile email |
| `listAbgemachtProjectsPage` | 500-row in-memory slice | DB pagination migration |

---

## RLS and performance

- RPCs as **invoker** still enforce RLS — test as `authenticated`, not only service role
- Broad policies + joins can be slow — index FK columns used in joins
- Org scoping: always pass/check `organization_id` in definer RPCs

---

## Migration checklist

1. User approves migration explicitly
2. Add `supabase/migrations/YYYYMMDDHHMMSS_perf_*.sql`
3. Add `scripts/perf/verify-*.sql`
4. Wire [`lib/db/repository.ts`](../../../lib/db/repository.ts) with fallback
5. `npm run db:push` (or CI) to target environment
6. Run verify SQL + HAR + `slow_operation` logs

---

## Connection / ops

- Transaction **pooler** for serverless (`.env.example`)
- Align Netlify ↔ Supabase region
- Migration history must be in sync or `db:push` fails — repair before new migrations

---

## When to add a new RPC

Add RPC when:

- ≥2 round-trips for one user-visible action (bootstrap, calendar range)
- Repeated aggregation (`GROUP BY status`, next appointment map)
- Join fan-out in PostgREST (appointments + projects + profiles)

Defer RPC when:

- HAR gate already green
- Payload size not TTFB (Phase 2b lesson: slim fields first)
- One-off admin path

---

## Related repository hotspots

[`lib/db/repository.ts`](../../../lib/db/repository.ts) (~2300 LOC):

- `getProjectCore` / `getProjectCoreHead` / `getProjectCoreDetails`
- `loadProjekteBootstrapData`
- `listProjectsForOfficePage`
- `weekTasksFromAppointmentRange`
- `listAvailabilityForRange`
- `attachNextAppointmentsForProjects`

Use `explain-top-queries.sql` against production-like data when tuning.
