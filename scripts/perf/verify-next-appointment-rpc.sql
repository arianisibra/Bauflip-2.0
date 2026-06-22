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
-- Verified 2026-05-26 on prod: org 14dff19e-7c28-420d-9af4-e8e08114c167 returns rows.
-- select * from public.next_appointment_starts_for_org('14dff19e-7c28-420d-9af4-e8e08114c167'::uuid) limit 5;

-- 4) In Netlify function logs after deploy: no lines like
--    [bauflip] next_appointment_starts_for_org: ...
