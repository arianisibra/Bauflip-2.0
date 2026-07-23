-- Bestellungen je Projekt: mehrere Zeilen (Lieferant, was, wann bestellt,
-- wann eingetroffen) statt der bisherigen freien Bestellformular-Notizen.
-- Kein Lieferanten-Stamm vorhanden (siehe order_form_templates.supplier_name)
-- — Lieferant bleibt bewusst Freitext, analog zur bestehenden Konvention.

create table if not exists public.project_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  supplier_name text not null,
  description text not null,
  ordered_at date not null default current_date,
  expected_at date,
  received_at timestamptz,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.project_orders is
  'Bestellzeilen je Projekt (Lieferant frei, bestellt/eingetroffen-Datum) — Grundlage für die «zu lange offen»-Markierung.';

create index if not exists idx_project_orders_project on public.project_orders (project_id, ordered_at desc);
create index if not exists idx_project_orders_org_open on public.project_orders (organization_id, received_at);

alter table public.project_orders enable row level security;

-- Lesen: alle aktiven Mitglieder der Organisation.
create policy "project_orders_select_org"
on public.project_orders
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
create policy "project_orders_insert_office_admin"
on public.project_orders
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

create policy "project_orders_update_office_admin"
on public.project_orders
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

create policy "project_orders_delete_office_admin"
on public.project_orders
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
