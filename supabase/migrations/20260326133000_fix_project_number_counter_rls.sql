-- Fix: project reference number trigger must bypass client RLS
-- Root cause:
-- assign_project_reference_code() was created without SECURITY DEFINER,
-- so inserts into project_number_counters were executed with caller rights.
-- If RLS is enabled there (or enabled later), project creation fails.

alter table public.project_number_counters disable row level security;

alter function public.assign_project_reference_code() security definer;
alter function public.assign_project_reference_code() set search_path = public;

revoke all on public.project_number_counters from public;
