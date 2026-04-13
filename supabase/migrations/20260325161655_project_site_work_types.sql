-- Objekte (Standorte), erweiterbare Arbeitsarten, erweiterte Projekt-Stammdaten

create table if not exists public.site_properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  owner_contact_id uuid references public.contacts(id) on delete set null,
  street text,
  postal_code text,
  city text,
  country text not null default 'CH',
  maps_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_site_properties_org on public.site_properties(organization_id);
create index if not exists idx_site_properties_owner on public.site_properties(owner_contact_id);

create table if not exists public.project_work_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_project_work_types_org_name
  on public.project_work_types (organization_id, name);

create index if not exists idx_project_work_types_org_sort
  on public.project_work_types(organization_id, sort_order);

alter table public.projects
  add column if not exists tenant_unit text,
  add column if not exists site_phone text,
  add column if not exists site_mobile text,
  add column if not exists reference_code text,
  add column if not exists technician_notes text,
  add column if not exists property_id uuid references public.site_properties(id) on delete set null,
  add column if not exists maps_url text,
  add column if not exists work_type_id uuid references public.project_work_types(id) on delete set null,
  add column if not exists contact_person_id uuid references public.contact_persons(id) on delete set null,
  add column if not exists service_address_id uuid references public.contact_addresses(id) on delete set null,
  add column if not exists billing_address_id uuid references public.contact_addresses(id) on delete set null,
  add column if not exists hints_and_notes text;

create index if not exists idx_projects_property on public.projects(property_id);
create index if not exists idx_projects_work_type on public.projects(work_type_id);

insert into public.project_work_types (organization_id, name, sort_order)
select o.id, x.name, x.ord
from public.organizations o
cross join (
  values
    ('Bestandsaufnahme', 10),
    ('Rapport', 20),
    ('Reparatur / Montage', 30),
    ('Wartung', 40),
    ('Beratung', 50),
    ('Abklärung', 60)
) as x(name, ord)
on conflict (organization_id, name) do nothing;

alter table public.site_properties enable row level security;
alter table public.project_work_types enable row level security;

create policy "office_admin_read_site_properties"
on public.site_properties for select
using (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_insert_site_properties"
on public.site_properties for insert
with check (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_update_site_properties"
on public.site_properties for update
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_delete_site_properties"
on public.site_properties for delete
using (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_read_project_work_types"
on public.project_work_types for select
using (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_insert_project_work_types"
on public.project_work_types for insert
with check (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_update_project_work_types"
on public.project_work_types for update
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_delete_project_work_types"
on public.project_work_types for delete
using (public.current_user_role() in ('office', 'admin'));

create policy "technician_read_site_properties"
on public.site_properties for select
using (public.current_user_role() = 'technician');

create policy "technician_read_project_work_types"
on public.project_work_types for select
using (public.current_user_role() = 'technician');
