-- Prod verification: next_appointment_starts_for_org RPC + index (Phase 2 / A5).
-- Run in Supabase SQL Editor or: psql $DATABASE_URL -f scripts/perf/verify-next-appointment-rpc.sql

-- 1) Function exists
select proname, prosecdef, provolatile
from pg_proc
where proname = 'next_appointment_starts_for_org';

-- 2) Index exists
select indexname, indexdef
from pg_indexes
where tablename = 'appointments'
  and indexname = 'idx_appointments_ends_at';

-- 3) Smoke test (replace org id with a real organization_id from your tenant)
-- select * from public.next_appointment_starts_for_org('00000000-0000-0000-0000-000000000000'::uuid) limit 5;

-- 4) In Netlify function logs after deploy: no lines like
--    [bauflip] next_appointment_starts_for_org: ...
