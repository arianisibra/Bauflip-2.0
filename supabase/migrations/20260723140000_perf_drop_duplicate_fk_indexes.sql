-- Post-audit: drop redundant FK indexes (Supabase advisor duplicate_index).
-- Keeps explicit perf indexes: idx_project_attachments_project_id, idx_technician_reports_project_id.

drop index if exists public.project_attachments_project_id_fkey_idx;
drop index if exists public.technician_reports_project_id_fkey_idx;
