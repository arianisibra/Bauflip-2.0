-- Reference queries for EXPLAIN (ANALYZE, BUFFERS) against production-like data.
-- Run in Supabase SQL Editor or psql after replacing placeholders.
--
-- Office project list (see listProjectsForOffice in lib/db/repository.ts)
-- Uses projects.organization_id + order by created_at desc; index: idx_projects_org_created_at
explain (analyze, buffers)
select id, title, type, status, tenant_name, service_street, service_postal_code, service_city
from public.projects
where organization_id = '00000000-0000-0000-0000-000000000000'::uuid
order by created_at desc;

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
