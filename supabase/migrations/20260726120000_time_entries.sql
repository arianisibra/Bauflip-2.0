-- Zeiterfassung: manueller Tageseintrag je Mitarbeiter (Admin, Büro, Monteur).
-- Jeder erfasst/bearbeitet/löscht die eigenen Einträge; Office/Admin sehen und verwalten
-- zusätzlich alle Einträge der eigenen Organisation (z.B. zum Nachtragen/Korrigieren).
--
-- Sicherheits-Hinweis: Org-Scoping bewusst über einen direkten
-- organization_memberships-Join (wie technician_absences), NICHT über
-- current_organization_id() — dieser Helper liefert nur die erste aktive Mitgliedschaft
-- und würde bei Mehrfach-Org-Mitgliedern falsch scopen.

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  entry_date date not null,
  starts_at time,
  ends_at time,
  hours numeric(5,2) not null check (hours > 0 and hours <= 24),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.time_entries is
  'Manuelle Zeiterfassung je Mitarbeiter (Datum, Von/Bis optional, Stunden, Notiz).';

create index if not exists idx_time_entries_user_date
  on public.time_entries (user_id, entry_date);

create index if not exists idx_time_entries_org_date
  on public.time_entries (organization_id, entry_date);

create index if not exists idx_time_entries_created_by
  on public.time_entries (created_by);

drop trigger if exists time_entries_touch_updated_at on public.time_entries;
create trigger time_entries_touch_updated_at
before update on public.time_entries
for each row execute function public.touch_updated_at();

alter table public.time_entries enable row level security;

-- Lesen: eigene Einträge ODER Office/Admin der eigenen Organisation.
drop policy if exists "time_entries_select_own_or_office_admin" on public.time_entries;
create policy "time_entries_select_own_or_office_admin"
on public.time_entries
for select
using (
  user_id = (select auth.uid())
  or (
    public.current_user_role() in ('admin', 'office')
    and organization_id in (
      select om.organization_id
      from public.organization_memberships om
      where om.user_id = (select auth.uid())
        and om.is_active
    )
  )
);

-- Erfassen: eigene Einträge ODER Office/Admin (z.B. Nacherfassung für Mitarbeiter).
drop policy if exists "time_entries_insert_own_or_office_admin" on public.time_entries;
create policy "time_entries_insert_own_or_office_admin"
on public.time_entries
for insert
with check (
  (
    user_id = (select auth.uid())
    and organization_id in (
      select om.organization_id
      from public.organization_memberships om
      where om.user_id = (select auth.uid())
        and om.is_active
    )
  )
  or (
    public.current_user_role() in ('admin', 'office')
    and organization_id in (
      select om.organization_id
      from public.organization_memberships om
      where om.user_id = (select auth.uid())
        and om.is_active
    )
  )
);

-- Bearbeiten: eigene Einträge ODER Office/Admin der eigenen Organisation.
drop policy if exists "time_entries_update_own_or_office_admin" on public.time_entries;
create policy "time_entries_update_own_or_office_admin"
on public.time_entries
for update
using (
  user_id = (select auth.uid())
  or (
    public.current_user_role() in ('admin', 'office')
    and organization_id in (
      select om.organization_id
      from public.organization_memberships om
      where om.user_id = (select auth.uid())
        and om.is_active
    )
  )
)
with check (
  user_id = (select auth.uid())
  or (
    public.current_user_role() in ('admin', 'office')
    and organization_id in (
      select om.organization_id
      from public.organization_memberships om
      where om.user_id = (select auth.uid())
        and om.is_active
    )
  )
);

-- Löschen: eigene Einträge ODER Office/Admin der eigenen Organisation.
drop policy if exists "time_entries_delete_own_or_office_admin" on public.time_entries;
create policy "time_entries_delete_own_or_office_admin"
on public.time_entries
for delete
using (
  user_id = (select auth.uid())
  or (
    public.current_user_role() in ('admin', 'office')
    and organization_id in (
      select om.organization_id
      from public.organization_memberships om
      where om.user_id = (select auth.uid())
        and om.is_active
    )
  )
);
