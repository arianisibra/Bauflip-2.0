-- Reference queries for EXPLAIN (ANALYZE, BUFFERS) against production-like data.
-- Run in Supabase SQL Editor or psql after replacing placeholders.
--
-- Office project list page 1 (see listProjectsForOfficePage in lib/db/repository.ts)
-- Default «active»: partial index idx_projects_org_created_active; fallback idx_projects_org_created_at
explain (analyze, buffers)
select id, title, type, status, tenant_name, created_at
from public.projects
where organization_id = '00000000-0000-0000-0000-000000000000'::uuid
  and status <> 'abgeschlossen'
order by created_at desc, id desc
limit 51;

-- Combined bootstrap RPC (page 1 + status counts — Phase 2e)
explain (analyze, buffers)
select public.projekte_office_bootstrap(
  '00000000-0000-0000-0000-000000000000'::uuid,
  'active',
  null,
  50
);

-- Status dropdown counts (RPC project_status_counts_for_org)
explain (analyze, buffers)
select p.status::text, count(*)::bigint
from public.projects p
where p.organization_id = '00000000-0000-0000-0000-000000000000'::uuid
group by p.status;

-- Server search (trgm indexes on title, tenant_name, …)
explain (analyze, buffers)
select id, title, type, status, tenant_name, created_at
from public.projects
where organization_id = '00000000-0000-0000-0000-000000000000'::uuid
  and status <> 'abgeschlossen'
  and (
    title ilike '%müller%'
    or tenant_name ilike '%müller%'
    or service_street ilike '%müller%'
    or service_city ilike '%müller%'
    or service_postal_code ilike '%müller%'
    or reference_code ilike '%müller%'
  )
order by created_at desc, id desc
limit 51;

-- Week / “Mein Tag” task list (see listWeekTasks in lib/db/repository.ts)
-- Range on appointments.starts_at; index: idx_appointments_starts_at
explain (analyze, buffers)
select a.id, a.project_id, a.kind, a.starts_at, a.ends_at, a.assigned_technician_id
from public.appointments a
where a.starts_at >= timestamptz '2026-04-07T00:00:00Z'
  and a.starts_at <= timestamptz '2026-04-13T23:59:59Z'
order by a.starts_at asc;

-- Project detail appointments (see getProjectCore)
-- Composite supports filter + order; index: idx_appointments_project_starts_at (migration 20260413120000)
explain (analyze, buffers)
select id, project_id, kind, starts_at, ends_at, assigned_technician_id, planning_notes, access_notes, key_handling_notes, created_at
from public.appointments
where project_id = '00000000-0000-0000-0000-000000000000'::uuid
order by starts_at asc;
