-- Verify projekte_office_bootstrap (Phase 2e — no UI change).
-- Replace org id before running in Supabase SQL Editor.

select public.projekte_office_bootstrap(
  '00000000-0000-0000-0000-000000000000'::uuid,
  'active',
  null,
  50
) as bootstrap_active;

select public.projekte_office_bootstrap(
  '00000000-0000-0000-0000-000000000000'::uuid,
  'abgemacht',
  null,
  50
) -> 'deferred' as abgemacht_deferred;

-- Partial index for default «active» list
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'projects'
  and indexname = 'idx_projects_org_created_active';
