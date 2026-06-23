-- Prod verification: project_core_bootstrap RPC (PR-I / Tier 1).
-- Run in Supabase SQL Editor or: psql $DATABASE_URL -f scripts/perf/verify-project-core-bootstrap-rpc.sql

-- 1) Function exists
select proname, prosecdef, provolatile
from pg_proc
where proname = 'project_core_bootstrap';

-- 2) FK indexes used by sheet load (informational)
select indexname, tablename
from pg_indexes
where schemaname = 'public'
  and tablename in ('appointments', 'project_attachments', 'technician_reports')
  and indexname like '%project%';

-- 3) Smoke test (replace with a real project id from your org)
-- select jsonb_typeof(public.project_core_bootstrap('00000000-0000-0000-0000-000000000000'::uuid));
-- Expect: object with keys project, appointments, attachments, reports — or null if id missing / RLS

-- 4) After deploy: Netlify logs should show loadProjectCoreBootstrap;
--    fallback project_core_bootstrap_rpc_fallback only if RPC missing or parse error.
