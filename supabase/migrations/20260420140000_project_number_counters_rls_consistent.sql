-- Supabase linter:
-- - 0007_policy_exists_rls_disabled: policies on project_number_counters while RLS was off
-- - 0013_rls_disabled_in_public: public table without RLS
--
-- Counter is internal (trigger only). RLS ON + explicit deny for API roles matches
-- contact_kunden_counters pattern. Trigger assign_project_reference_code() stays SECURITY DEFINER.

drop policy if exists "project_number_counters_no_rest" on public.project_number_counters;

alter table public.project_number_counters enable row level security;

create policy "project_number_counters_no_rest"
on public.project_number_counters
for all
to anon, authenticated
using (false)
with check (false);

alter function public.assign_project_reference_code() security definer;
alter function public.assign_project_reference_code() set search_path = public;

revoke all on public.project_number_counters from public;
