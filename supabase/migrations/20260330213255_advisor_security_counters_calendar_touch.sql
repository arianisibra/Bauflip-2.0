-- Supabase Security/Performance advisors (2026-03-30):
-- - rls_disabled_in_public: project_number_counters
-- - rls_enabled_no_policy: contact_kunden_* (explicit deny for API roles)
-- - auth_rls_initplan: calendar_provider_tokens (select auth.uid())
-- - function_search_path_mutable: touch_updated_at

alter table public.project_number_counters enable row level security;

alter table public.contact_kunden_counters enable row level security;
alter table public.contact_kunden_counter_null_org enable row level security;

drop policy if exists "contact_kunden_counters_no_rest" on public.contact_kunden_counters;
create policy "contact_kunden_counters_no_rest"
on public.contact_kunden_counters
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "contact_kunden_counter_null_org_no_rest" on public.contact_kunden_counter_null_org;
create policy "contact_kunden_counter_null_org_no_rest"
on public.contact_kunden_counter_null_org
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "calendar_provider_tokens_select_own" on public.calendar_provider_tokens;
create policy "calendar_provider_tokens_select_own"
on public.calendar_provider_tokens
for select
using (profile_id = (select auth.uid()));

drop policy if exists "calendar_provider_tokens_insert_own" on public.calendar_provider_tokens;
create policy "calendar_provider_tokens_insert_own"
on public.calendar_provider_tokens
for insert
with check (profile_id = (select auth.uid()));

drop policy if exists "calendar_provider_tokens_update_own" on public.calendar_provider_tokens;
create policy "calendar_provider_tokens_update_own"
on public.calendar_provider_tokens
for update
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

drop policy if exists "calendar_provider_tokens_delete_own" on public.calendar_provider_tokens;
create policy "calendar_provider_tokens_delete_own"
on public.calendar_provider_tokens
for delete
using (profile_id = (select auth.uid()));

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
