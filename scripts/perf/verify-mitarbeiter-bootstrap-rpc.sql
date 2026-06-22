-- Prod verification: mitarbeiter_office_bootstrap RPC (Phase Mit-DB).
-- Run in Supabase SQL Editor or: psql $DATABASE_URL -f scripts/perf/verify-mitarbeiter-bootstrap-rpc.sql

-- 1) Function exists
select proname, prosecdef, provolatile
from pg_proc
where proname = 'mitarbeiter_office_bootstrap';

-- 2) Smoke test (replace with your org id if needed)
-- select jsonb_pretty(
--   public.mitarbeiter_office_bootstrap(
--     (select public.current_organization_id())
--   )
-- );

-- 3) After deploy: 0 POST /mitarbeiter within 500ms of document load (HAR gate)
