create extension if not exists "pgcrypto";

create type app_role as enum ('admin', 'office', 'technician');
create type project_type as enum ('reparatur', 'ersatz', 'neuinstallation');
create type project_status as enum (
  'anfrage',
  'termin_geplant',
  'besichtigung',
  'bericht_ausstehend',
  'bericht_fertig',
  'offerte_in_arbeit',
  'offerte_gesendet',
  'genehmigt',
  'bestellung',
  'bestellt',
  'ware_eingetroffen',
  'ausfuehrung_geplant',
  'ausfuehrung_erledigt',
  'rechnung',
  'abgeschlossen'
);
create type note_type as enum ('kunde', 'intern', 'planung', 'techniker', 'bestellung', 'rechnung');
create type appointment_kind as enum ('besichtigung', 'ausfuehrung');
create type report_outcome as enum ('direkt_geloest', 'ersatzteil_noetig', 'werkstatt_noetig', 'vollersatz_noetig');
create type quote_status as enum ('entwurf', 'gesendet', 'genehmigt', 'abgelehnt');
create type order_status as enum ('entwurf', 'gesendet', 'bestaetigt', 'geliefert');
create type invoice_status as enum ('entwurf', 'gesendet', 'bezahlt');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null default 'office',
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  street text,
  postal_code text,
  city text,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role_label text,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  title text not null,
  type project_type not null,
  status project_status not null default 'anfrage',
  next_owner_role app_role not null default 'office',
  next_owner_user_id uuid references public.profiles(id) on delete set null,
  source text not null check (source in ('whatsapp', 'telefon', 'email')),
  urgency text not null check (urgency in ('normal', 'hoch', 'kritisch')),
  intake_original_text text not null,
  access_notes text,
  key_handling_notes text,
  timing_notes text,
  internal_notes text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_status_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  from_status project_status,
  to_status project_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  note_type note_type not null,
  body text not null,
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.project_attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes integer,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind appointment_kind not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  assigned_technician_id uuid references public.profiles(id) on delete set null,
  planning_notes text,
  access_notes text,
  key_handling_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.technician_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  outcome report_outcome not null,
  summary text not null,
  measurements_json jsonb not null default '{}'::jsonb,
  work_description text not null,
  time_spent_minutes integer,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version integer not null default 1,
  status quote_status not null default 'entwurf',
  sent_at timestamptz,
  approved_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit text not null default 'Stk',
  unit_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_order_templates (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  name text not null,
  field_schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  status order_status not null default 'entwurf',
  email_sent_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit text not null default 'Stk',
  created_at timestamptz not null default now()
);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  delivery_note_number text,
  arrived_at timestamptz not null default now(),
  checked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit text not null default 'Stk',
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  invoice_number text,
  status invoice_status not null default 'entwurf',
  sent_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_customer on public.projects(customer_id);
create index if not exists idx_projects_status on public.projects(status);
create index if not exists idx_notes_project on public.project_notes(project_id);
create index if not exists idx_appointments_project on public.appointments(project_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
before update on public.projects
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.projects enable row level security;
alter table public.project_status_events enable row level security;
alter table public.project_notes enable row level security;
alter table public.project_attachments enable row level security;
alter table public.appointments enable row level security;
alter table public.technician_reports enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_order_templates enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_items enable row level security;
alter table public.invoices enable row level security;

create or replace function public.current_user_role()
returns app_role language sql stable as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role')::app_role,
    (select role from public.profiles where id = auth.uid()),
    'office'::app_role
  );
$$;

create policy "profiles_own_read"
on public.profiles
for select
using (id = auth.uid());

create policy "profiles_admin_manage"
on public.profiles
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "office_admin_read_customers"
on public.customers
for select
using (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_write_customers"
on public.customers
for all
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_read_projects"
on public.projects
for select
using (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_write_projects"
on public.projects
for all
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "technician_assigned_projects"
on public.projects
for select
using (
  public.current_user_role() = 'technician'
  and (
    next_owner_user_id = auth.uid()
    or exists (
      select 1
      from public.appointments a
      where a.project_id = projects.id
        and a.assigned_technician_id = auth.uid()
    )
  )
);

create policy "project_children_read"
on public.project_notes
for select
using (
  public.current_user_role() in ('office', 'admin')
  or exists (
    select 1 from public.projects p
    where p.id = project_notes.project_id
      and (
        p.next_owner_user_id = auth.uid()
        or public.current_user_role() = 'technician'
      )
  )
);

create policy "project_children_write_office_admin"
on public.project_notes
for all
using (public.current_user_role() in ('office', 'admin', 'technician'))
with check (public.current_user_role() in ('office', 'admin', 'technician'));

create policy "allow_role_based_read_all_domain"
on public.customer_contacts
for select using (public.current_user_role() in ('office', 'admin'));

create policy "allow_role_based_write_all_domain"
on public.customer_contacts
for all using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "appointments_read_by_role"
on public.appointments
for select
using (
  public.current_user_role() in ('office', 'admin')
  or assigned_technician_id = auth.uid()
);

create policy "appointments_write_office_admin"
on public.appointments
for all
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "technician_reports_read"
on public.technician_reports
for select
using (
  public.current_user_role() in ('office', 'admin')
  or created_by = auth.uid()
);

create policy "technician_reports_write"
on public.technician_reports
for insert
with check (
  public.current_user_role() in ('office', 'admin', 'technician')
);

create policy "admin_office_all_simple_tables"
on public.project_status_events
for all
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "admin_office_quotes"
on public.quotes
for all
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "admin_office_quote_items"
on public.quote_items
for all
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "admin_office_suppliers"
on public.suppliers
for all
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "admin_office_order_templates"
on public.supplier_order_templates
for all
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "admin_office_purchase_orders"
on public.purchase_orders
for all
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "admin_office_purchase_order_items"
on public.purchase_order_items
for all
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "admin_office_deliveries"
on public.deliveries
for all
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "admin_office_delivery_items"
on public.delivery_items
for all
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "admin_office_invoices"
on public.invoices
for all
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "attachments_read"
on public.project_attachments
for select
using (
  public.current_user_role() in ('office', 'admin')
  or exists (
    select 1
    from public.projects p
    where p.id = project_attachments.project_id
      and p.next_owner_user_id = auth.uid()
  )
);

create policy "attachments_write"
on public.project_attachments
for all
using (public.current_user_role() in ('office', 'admin', 'technician'))
with check (public.current_user_role() in ('office', 'admin', 'technician'));
