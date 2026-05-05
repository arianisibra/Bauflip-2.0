-- Abwesenheiten für Monteure (Ferien / Krank / Blocker) — Grundlage für Verfügbarkeitsanzeige.
-- Office/Admin: erfassen und löschen. Alle aktiven Org-Mitglieder dürfen lesen.

create table if not exists public.technician_absences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  technician_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind text not null check (kind in ('ferien', 'krank', 'blocker')),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint technician_absences_range_valid check (ends_at > starts_at)
);

comment on table public.technician_absences is
  'Abwesenheits-Slots je Monteur (Ferien/Krank/Blocker). Wird mit appointments für Verfügbarkeit kombiniert.';

create index if not exists idx_technician_absences_tech_range
  on public.technician_absences (technician_id, starts_at, ends_at);

create index if not exists idx_technician_absences_org_starts
  on public.technician_absences (organization_id, starts_at);

alter table public.technician_absences enable row level security;

-- Lesen: alle aktiven Mitglieder der Organisation (Office, Admin und Monteure sehen Verfügbarkeiten ihres Teams).
create policy "technician_absences_select_org"
on public.technician_absences
for select
using (
  organization_id in (
    select om.organization_id
    from public.organization_memberships om
    where om.user_id = (select auth.uid())
      and om.is_active
  )
);

-- Schreiben: Office und Admin der eigenen Organisation.
create policy "technician_absences_insert_office_admin"
on public.technician_absences
for insert
with check (
  public.current_user_role() in ('admin', 'office')
  and organization_id in (
    select om.organization_id
    from public.organization_memberships om
    where om.user_id = (select auth.uid())
      and om.is_active
  )
);

create policy "technician_absences_update_office_admin"
on public.technician_absences
for update
using (
  public.current_user_role() in ('admin', 'office')
  and organization_id in (
    select om.organization_id
    from public.organization_memberships om
    where om.user_id = (select auth.uid())
      and om.is_active
  )
)
with check (
  public.current_user_role() in ('admin', 'office')
  and organization_id in (
    select om.organization_id
    from public.organization_memberships om
    where om.user_id = (select auth.uid())
      and om.is_active
  )
);

create policy "technician_absences_delete_office_admin"
on public.technician_absences
for delete
using (
  public.current_user_role() in ('admin', 'office')
  and organization_id in (
    select om.organization_id
    from public.organization_memberships om
    where om.user_id = (select auth.uid())
      and om.is_active
  )
);
