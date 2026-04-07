-- Bauflip Kern-Downsizing: eingebettete Stammdaten am Auftrag, vereinfachte Status/Report-Outcomes,
-- Entfernen von Kanban, CRM-Kontakten, Einkauf/Offerten, Integrationstabellen.

-- ---------------------------------------------------------------------------
-- 1) Abhängige Business-Tabellen entfernen (Reihenfolge: Kinder zuerst)
-- ---------------------------------------------------------------------------
drop table if exists public.quote_items cascade;
drop table if exists public.quotes cascade;
drop table if exists public.purchase_order_items cascade;
drop table if exists public.purchase_orders cascade;
drop table if exists public.delivery_items cascade;
drop table if exists public.deliveries cascade;
drop table if exists public.invoices cascade;
drop table if exists public.stock_decisions cascade;
drop table if exists public.supplier_order_form_submissions cascade;
drop table if exists public.supplier_order_form_templates cascade;
drop table if exists public.articles cascade;
drop table if exists public.article_categories cascade;
drop table if exists public.kanban_cards cascade;
drop table if exists public.kanban_columns cascade;
drop table if exists public.project_chat_attachments cascade;
drop table if exists public.project_chat_messages cascade;
drop table if exists public.calendar_events cascade;
drop table if exists public.report_outcome_options cascade;
drop table if exists public.report_select_options cascade;
drop table if exists public.ui_module_labels cascade;
drop table if exists public.employee_metrics_snapshots cascade;
drop table if exists public.audit_events cascade;
drop table if exists public.mail_messages cascade;
drop table if exists public.smtp_accounts cascade;
drop table if exists public.project_status_events cascade;
drop table if exists public.supplier_order_templates cascade;
drop table if exists public.suppliers cascade;
drop table if exists public.calendar_provider_tokens cascade;

-- ---------------------------------------------------------------------------
-- 2) technician_reports: Outcome auf zwei Werte (Text + Check)
-- ---------------------------------------------------------------------------
alter table public.technician_reports
  add column if not exists outcome_text text;

update public.technician_reports
set outcome_text = case
  when outcome::text = 'direkt_geloest' then 'schaden_behoben'
  else 'schaden_aufgenommen'
end
where outcome_text is null;

alter table public.technician_reports drop column if exists outcome;

alter table public.technician_reports rename column outcome_text to outcome;

alter table public.technician_reports
  alter column outcome set not null;

alter table public.technician_reports
  add constraint technician_reports_outcome_check
  check (outcome in ('schaden_behoben', 'schaden_aufgenommen'));

drop type if exists public.report_outcome;

-- ---------------------------------------------------------------------------
-- 3) projects: eingebettete Stammdaten + organization_id, alte FKs entfernen
-- ---------------------------------------------------------------------------
alter table public.projects
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

alter table public.projects
  add column if not exists tenant_name text,
  add column if not exists tenant_phone text,
  add column if not exists tenant_email text,
  add column if not exists management_name text,
  add column if not exists management_phone text,
  add column if not exists management_email text,
  add column if not exists cost_ceiling_text text,
  add column if not exists service_street text,
  add column if not exists service_postal_code text,
  add column if not exists service_city text,
  add column if not exists service_country text not null default 'CH';

-- Backfill organisation + Stammdaten aus Kontaktmodell
update public.projects p
set organization_id = c.organization_id
from public.contacts c
where p.contact_id is not null
  and c.id = p.contact_id
  and p.organization_id is null;

update public.projects p
set organization_id = (select id from public.organizations order by created_at asc limit 1)
where p.organization_id is null
  and exists (select 1 from public.organizations limit 1);

-- Subquery: Zieltabelle "p" darf nicht in JOIN-ON des FROM der äusseren UPDATE stehen (PostgreSQL).
update public.projects p
set
  tenant_name = sub.tenant_name,
  tenant_phone = sub.tenant_phone,
  tenant_email = sub.tenant_email,
  management_name = sub.management_name,
  management_phone = sub.management_phone,
  management_email = sub.management_email,
  cost_ceiling_text = sub.cost_ceiling_text
from (
  select
    p2.id as pid,
    coalesce(
      nullif(trim(concat_ws(' ', cp.first_name, cp.last_name)), ''),
      nullif(trim(c.name), '')
    ) as tenant_name,
    coalesce(cp.phone, cp.mobile, c.phone, c.mobile) as tenant_phone,
    coalesce(cp.email, c.email) as tenant_email,
    case when cp.id is not null then nullif(trim(c.name), '') else null end as management_name,
    case when cp.id is not null then c.phone else null end as management_phone,
    case when cp.id is not null then c.email else null end as management_email,
    coalesce(p2.hints_and_notes, p2.internal_notes) as cost_ceiling_text
  from public.projects p2
  join public.contacts c on c.id = p2.contact_id
  left join public.contact_persons cp on cp.id = p2.contact_person_id
) sub
where p.id = sub.pid;

update public.projects p
set
  service_street = sub.service_street,
  service_postal_code = sub.service_postal_code,
  service_city = sub.service_city,
  service_country = sub.service_country
from (
  select
    p2.id as pid,
    coalesce(ca.street, c.street, sp.street) as service_street,
    coalesce(ca.postal_code, c.postal_code, sp.postal_code) as service_postal_code,
    coalesce(ca.city, c.city, sp.city) as service_city,
    coalesce(nullif(trim(ca.country), ''), nullif(trim(sp.country), ''), 'CH') as service_country
  from public.projects p2
  join public.contacts c on c.id = p2.contact_id
  left join public.contact_addresses ca on ca.id = p2.service_address_id
  left join public.site_properties sp on sp.id = p2.property_id
) sub
where p.id = sub.pid;

-- FKs und Spalten entfernen, die nicht mehr zum Kern gehören
alter table public.projects drop constraint if exists projects_contact_id_fkey;
alter table public.projects drop constraint if exists projects_property_id_fkey;
alter table public.projects drop constraint if exists projects_work_type_id_fkey;
alter table public.projects drop constraint if exists projects_contact_person_id_fkey;
alter table public.projects drop constraint if exists projects_service_address_id_fkey;
alter table public.projects drop constraint if exists projects_billing_address_id_fkey;

alter table public.projects drop column if exists contact_id;
alter table public.projects drop column if exists property_id;
alter table public.projects drop column if exists work_type_id;
alter table public.projects drop column if exists contact_person_id;
alter table public.projects drop column if exists service_address_id;
alter table public.projects drop column if exists billing_address_id;
alter table public.projects drop column if exists maps_url;
alter table public.projects drop column if exists tenant_unit;
alter table public.projects drop column if exists site_phone;
alter table public.projects drop column if exists site_mobile;

-- ---------------------------------------------------------------------------
-- 4) project_status ersetzen (Text + Check)
-- ---------------------------------------------------------------------------
alter table public.projects add column if not exists status_text text;

update public.projects
set status_text = case status::text
  when 'abgeschlossen' then 'abgeschlossen'
  when 'termin_geplant' then 'termin_geplant'
  when 'besichtigung' then 'termin_geplant'
  when 'anfrage' then 'offen'
  else 'einsatz_offen'
end
where status_text is null;

update public.projects set status_text = 'offen' where status_text is null;

alter table public.projects alter column status_text set not null;

alter table public.projects drop column if exists status;

alter table public.projects rename column status_text to status;

alter table public.projects
  add constraint projects_status_check
  check (status in ('offen', 'termin_geplant', 'einsatz_offen', 'abgeschlossen'));

drop type if exists public.project_status;

-- ---------------------------------------------------------------------------
-- 5) Kontakte & Objekte entfernen
-- ---------------------------------------------------------------------------
drop trigger if exists contacts_assign_kunden_number_before_insert on public.contacts;
drop function if exists public.contacts_assign_kunden_number ();

drop table if exists public.contact_persons cascade;
drop table if exists public.contact_addresses cascade;
drop table if exists public.contacts cascade;
drop table if exists public.contact_kunden_counters cascade;
drop table if exists public.contact_kunden_counter_null_org cascade;
drop table if exists public.site_properties cascade;
drop table if exists public.project_work_types cascade;

-- ---------------------------------------------------------------------------
-- 6) profiles: Dashboard-Layout entfernen
-- ---------------------------------------------------------------------------
alter table public.profiles drop column if exists dashboard_layout;

-- ---------------------------------------------------------------------------
-- 7) organizations: Zapier-Spalten entfernen
-- ---------------------------------------------------------------------------
alter table public.organizations drop column if exists zapier_enabled;
alter table public.organizations drop column if exists zapier_webhook_url;
alter table public.organizations drop column if exists zapier_signing_secret;
alter table public.organizations drop column if exists zapier_last_test_at;
alter table public.organizations drop column if exists zapier_last_error;

-- ---------------------------------------------------------------------------
-- 8) Indizes für Kern-Workflow
-- ---------------------------------------------------------------------------
create index if not exists idx_projects_org_status on public.projects (organization_id, status);
create index if not exists idx_appointments_tech_starts on public.appointments (assigned_technician_id, starts_at);

-- ---------------------------------------------------------------------------
-- 9) RLS projects: Policy bleibt kompatibel (technician_assigned_projects nutzt appointments)
-- ---------------------------------------------------------------------------
-- Keine Änderung nötig: projects_read_role_based / office policies aus früheren Migrationen greifen weiter.
