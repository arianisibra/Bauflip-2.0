-- Supabase-Advisor-Fixes für den Offerten-Nummernkreis (Audit nach Phase 1–7):
-- - 0013_rls_disabled_in_public: quote_number_counters war ohne RLS öffentlich sichtbar
-- - 0028/0029: assign_quote_number() als SECURITY DEFINER via PostgREST-RPC aufrufbar
--
-- Muster identisch zu project_number_counters (20260420140000) und
-- assign_project_reference_code (20260420160000): RLS ON + Deny-Policy für API-Rollen,
-- Trigger-Funktion nur für postgres/service_role ausführbar (BEFORE-INSERT-Trigger
-- läuft als Table-Owner weiter).

drop policy if exists "quote_number_counters_no_rest" on public.quote_number_counters;

alter table public.quote_number_counters enable row level security;

create policy "quote_number_counters_no_rest"
on public.quote_number_counters
for all
to anon, authenticated
using (false)
with check (false);

revoke all on public.quote_number_counters from public;
revoke all on public.quote_number_counters from anon;
revoke all on public.quote_number_counters from authenticated;

revoke all on function public.assign_quote_number() from public;
revoke all on function public.assign_quote_number() from anon;
revoke all on function public.assign_quote_number() from authenticated;
grant execute on function public.assign_quote_number() to postgres;
grant execute on function public.assign_quote_number() to service_role;

-- Nebenbefund Advisor (INFO, unindexed_foreign_keys): FK-Index für quotes.created_by.
create index if not exists idx_quotes_created_by on public.quotes (created_by);
