create table if not exists public.calendar_provider_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  refresh_token text not null,
  email_hint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, provider)
);

create index if not exists idx_calendar_provider_tokens_profile on public.calendar_provider_tokens(profile_id);

comment on table public.calendar_provider_tokens is 'OAuth Refresh Tokens für Google / Microsoft Kalender (pro Profil).';

alter table public.calendar_provider_tokens enable row level security;

create policy "calendar_provider_tokens_select_own"
on public.calendar_provider_tokens for select
using (profile_id = auth.uid());

create policy "calendar_provider_tokens_insert_own"
on public.calendar_provider_tokens for insert
with check (profile_id = auth.uid());

create policy "calendar_provider_tokens_update_own"
on public.calendar_provider_tokens for update
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "calendar_provider_tokens_delete_own"
on public.calendar_provider_tokens for delete
using (profile_id = auth.uid());
