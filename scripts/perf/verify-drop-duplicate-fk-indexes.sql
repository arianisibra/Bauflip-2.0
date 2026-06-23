-- Verify duplicate FK indexes were dropped (post-audit hygiene).
-- Run: psql "$DATABASE_URL" -f scripts/perf/verify-drop-duplicate-fk-indexes.sql

-- 1) Redundant indexes should be gone
select indexname, tablename
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'project_attachments_project_id_fkey_idx',
    'technician_reports_project_id_fkey_idx'
  );
-- Expect: 0 rows

-- 2) Explicit project_id indexes remain
select indexname, tablename
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_project_attachments_project_id',
    'idx_technician_reports_project_id'
  );
-- Expect: 2 rows
