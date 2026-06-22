-- Prod verification: calendar_range_tasks_for_org RPC (Phase Kal-DB).
-- Run in Supabase SQL Editor or: psql $DATABASE_URL -f scripts/perf/verify-calendar-range-rpc.sql

-- 1) Function exists
select proname, prosecdef, provolatile
from pg_proc
where proname = 'calendar_range_tasks_for_org';

-- 2) Index for range scan still present
select indexname, indexdef
from pg_indexes
where tablename = 'appointments'
  and indexname = 'idx_appointments_starts_at';

-- 3) Smoke test (replace org: use a day range where you expect appointments)
-- select jsonb_array_length(
--   public.calendar_range_tasks_for_org(
--     timestamptz '2026-06-22T00:00:00+02:00',
--     timestamptz '2026-06-22T23:59:59+02:00',
--     null
--   )
-- );

-- 4) In Netlify function logs after deploy: fewer slow_operation weekTasks lines;
--    fallback only if RPC missing: calendar_range_rpc_fallback in logs
