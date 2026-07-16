-- Kontakte Schritt 2: Verknüpfung Projekt ↔ Kontakt je Rolle (Mieter / Verwaltung).
-- Bewusst als NEUE Verknüpfungstabelle statt Spalten auf `projects` — so bleibt die
-- Live-Tabelle `projects` unberührt, und ein Projekt kann pro Rolle einen Kontakt haben.
-- Die bestehenden tenant_*/management_*-Felder bleiben als Snapshot (Dokument-Stabilität).

create table if not exists public.project_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  role text not null check (role in ('mieter', 'verwaltung')),
  created_at timestamptz not null default now(),
  unique (project_id, role)
);

comment on table public.project_contacts is
  'Verknüpfung Projekt ↔ Kontakt je Rolle (Mieter/Verwaltung) — für Historie pro Kontakt.';

create index if not exists idx_project_contacts_contact on public.project_contacts (contact_id);
create index if not exists idx_project_contacts_project on public.project_contacts (project_id);

alter table public.project_contacts enable row level security;

drop policy if exists "project_contacts_all_office_admin_org" on public.project_contacts;
create policy "project_contacts_all_office_admin_org"
on public.project_contacts
for all
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
