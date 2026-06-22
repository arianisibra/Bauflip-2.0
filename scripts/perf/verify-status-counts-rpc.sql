-- Verify project_status_counts_for_org (Phase 2d — no UI change).
-- Replace org id before running in Supabase SQL Editor.
select * from public.project_status_counts_for_org('00000000-0000-0000-0000-000000000000'::uuid);
