-- assign_project_reference_code() was recreated in 20260411120001_auto_project_number
-- without SECURITY DEFINER. The BEFORE INSERT trigger then writes to project_number_counters
-- with the invoker's rights → RLS on that table blocks inserts → POST /projects 403 and app 500.
alter function public.assign_project_reference_code() security definer;
alter function public.assign_project_reference_code() set search_path = public;

-- Internal counter table: no client access via PostgREST (advisor-safe with trigger as definer).
alter table public.project_number_counters disable row level security;

revoke all on public.project_number_counters from public;
