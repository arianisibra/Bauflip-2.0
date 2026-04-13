-- Kunden → Kontakte: erweitertes Stammdatenmodell

create type public.contact_party_kind as enum ('privat', 'firma');
create type public.contact_category as enum ('kunde', 'lieferant', 'partner', 'sonstiges');

-- Policies vor Umbenennung entfernen
drop policy if exists "office_admin_read_customers" on public.customers;
drop policy if exists "office_admin_insert_customers" on public.customers;
drop policy if exists "office_admin_update_customers" on public.customers;
drop policy if exists "office_admin_delete_customers" on public.customers;

drop policy if exists "allow_role_based_read_all_domain" on public.customer_contacts;
drop policy if exists "allow_role_based_insert_all_domain" on public.customer_contacts;
drop policy if exists "allow_role_based_update_all_domain" on public.customer_contacts;
drop policy if exists "allow_role_based_delete_all_domain" on public.customer_contacts;

alter table public.customers rename to contacts;

alter index if exists idx_projects_customer rename to idx_projects_contact;

alter table public.projects rename column customer_id to contact_id;

alter table public.customer_contacts rename to contact_persons;
alter table public.contact_persons rename column customer_id to contact_id;

alter table public.contacts
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists party_kind public.contact_party_kind not null default 'firma',
  add column if not exists category public.contact_category not null default 'kunde',
  add column if not exists contact_number text,
  add column if not exists uid_number text,
  add column if not exists mobile text,
  add column if not exists website text,
  add column if not exists managed_object_label text;

update public.contacts
set organization_id = (select id from public.organizations order by created_at asc limit 1)
where organization_id is null
  and exists (select 1 from public.organizations limit 1);

update public.contacts
set contact_number = coalesce(
  contact_number,
  'K-' || upper(substring(replace(id::text, '-', '') from 1 for 10))
)
where contact_number is null;

alter table public.contact_persons add column if not exists first_name text;
alter table public.contact_persons add column if not exists last_name text;
alter table public.contact_persons add column if not exists mobile text;

update public.contact_persons
set last_name = coalesce(last_name, name)
where last_name is null and name is not null;

alter table public.contact_persons drop column if exists name;

alter table public.contact_persons rename column role_label to role_title;

create table if not exists public.contact_addresses (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  label text not null default 'Adresse',
  street text,
  postal_code text,
  city text,
  country text not null default 'CH',
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_contact_addresses_contact on public.contact_addresses(contact_id);

create unique index if not exists uq_contacts_org_number
  on public.contacts (organization_id, contact_number)
  where organization_id is not null and contact_number is not null;

create policy "office_admin_read_contacts"
on public.contacts for select
using (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_insert_contacts"
on public.contacts for insert
with check (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_update_contacts"
on public.contacts for update
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_delete_contacts"
on public.contacts for delete
using (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_read_contact_persons"
on public.contact_persons for select
using (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_insert_contact_persons"
on public.contact_persons for insert
with check (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_update_contact_persons"
on public.contact_persons for update
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_delete_contact_persons"
on public.contact_persons for delete
using (public.current_user_role() in ('office', 'admin'));

alter table public.contact_addresses enable row level security;

create policy "office_admin_read_contact_addresses"
on public.contact_addresses for select
using (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_insert_contact_addresses"
on public.contact_addresses for insert
with check (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_update_contact_addresses"
on public.contact_addresses for update
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_delete_contact_addresses"
on public.contact_addresses for delete
using (public.current_user_role() in ('office', 'admin'));
