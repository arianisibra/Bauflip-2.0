-- Kontakte (Schritt 1): wiederverwendbares Kontaktverzeichnis je Organisation
-- (Kunden, Mieter, Verwaltungen, Eigentümer, Lieferanten). Zum Auswählen &
-- Autofüllen beim Projekt/Angebot, statt jedes Mal neu zu tippen.
--
-- Desk-Feature: nur Office/Admin der eigenen Organisation (RLS wie price_book_items,
-- Org-Scoping über organization_memberships-Join, NICHT current_organization_id()).

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null default 'privat'
    check (kind in ('privat', 'mieter', 'verwaltung', 'eigentuemer', 'lieferant')),
  display_name text not null,
  company_name text,
  email text,
  phone text,
  mobile text,
  street text,
  postal_code text,
  city text,
  country text,
  notes text,
  kunden_nummer text,
  -- Für später (Bexio-Push): Verknüpfung zum Bexio-Kontakt.
  bexio_contact_id integer,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contacts is
  'Kontaktverzeichnis je Organisation: Kunden/Mieter/Verwaltungen/Eigentümer/Lieferanten zum Auswählen & Autofüllen.';

create index if not exists idx_contacts_org_active_name
  on public.contacts (organization_id, is_active, display_name);
create index if not exists idx_contacts_org_kind
  on public.contacts (organization_id, kind);
-- Freitextsuche (ILIKE) läuft über den Namen; bei der geringen Kontaktzahl je Org
-- genügt der org-scoped Scan — kein Trigram-Index nötig.

drop trigger if exists contacts_touch_updated_at on public.contacts;
create trigger contacts_touch_updated_at
before update on public.contacts
for each row execute function public.touch_updated_at();

alter table public.contacts enable row level security;

drop policy if exists "contacts_all_office_admin_org" on public.contacts;
create policy "contacts_all_office_admin_org"
on public.contacts
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
