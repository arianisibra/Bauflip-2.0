-- CMS-ähnliche Bestellformulare: Admin definiert Feld-Schemas pro Organisation;
-- Monteur füllt sie beim Rapport aus (technician_report_order_forms).

create table public.order_form_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  fields jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

comment on table public.order_form_templates is 'Admin-definierte Formular-Schemas (Felder) pro Organisation für Rapport/Bestellung.';

create table public.technician_report_order_forms (
  id uuid primary key default gen_random_uuid(),
  technician_report_id uuid not null references public.technician_reports(id) on delete cascade,
  template_id uuid not null references public.order_form_templates(id) on delete restrict,
  values_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (technician_report_id, template_id)
);

comment on table public.technician_report_order_forms is 'Ausgefüllte Bestellformulare je Rapport (1 Zeile pro Vorlage).';

create index idx_order_form_templates_org on public.order_form_templates (organization_id, is_active, sort_order);
create index idx_report_order_forms_report on public.technician_report_order_forms (technician_report_id);

alter table public.order_form_templates enable row level security;
alter table public.technician_report_order_forms enable row level security;

-- Vorlagen: Lesen für alle aktiven Mitglieder der Organisation
create policy "order_form_templates_select_org"
on public.order_form_templates
for select
using (
  organization_id in (
    select om.organization_id
    from public.organization_memberships om
    where om.user_id = (select auth.uid())
      and om.is_active
  )
);

-- Nur Admin, eigene Organisation
create policy "order_form_templates_insert_admin"
on public.order_form_templates
for insert
with check (
  public.current_user_role() = 'admin'
  and organization_id in (
    select om.organization_id
    from public.organization_memberships om
    where om.user_id = (select auth.uid())
      and om.is_active
  )
);

create policy "order_form_templates_update_admin"
on public.order_form_templates
for update
using (
  public.current_user_role() = 'admin'
  and organization_id in (
    select om.organization_id
    from public.organization_memberships om
    where om.user_id = (select auth.uid())
      and om.is_active
  )
)
with check (
  public.current_user_role() = 'admin'
  and organization_id in (
    select om.organization_id
    from public.organization_memberships om
    where om.user_id = (select auth.uid())
      and om.is_active
  )
);

create policy "order_form_templates_delete_admin"
on public.order_form_templates
for delete
using (
  public.current_user_role() = 'admin'
  and organization_id in (
    select om.organization_id
    from public.organization_memberships om
    where om.user_id = (select auth.uid())
      and om.is_active
  )
);

-- Ausfüllungen: wie Rapporte (Büro/Admin oder Urheber)
create policy "report_order_forms_select"
on public.technician_report_order_forms
for select
using (
  public.current_user_role() in ('office', 'admin')
  or exists (
    select 1
    from public.technician_reports tr
    where tr.id = technician_report_order_forms.technician_report_id
      and tr.created_by = (select auth.uid())
  )
);

create policy "report_order_forms_insert"
on public.technician_report_order_forms
for insert
with check (
  (
    public.current_user_role() in ('office', 'admin')
    and exists (
      select 1
      from public.technician_reports tr
      join public.projects p on p.id = tr.project_id
      join public.organization_memberships om
        on om.organization_id = p.organization_id
       and om.user_id = (select auth.uid())
       and om.is_active
      where tr.id = technician_report_order_forms.technician_report_id
    )
  )
  or
  (
    public.current_user_role() = 'technician'
    and exists (
      select 1
      from public.technician_reports tr
      join public.appointments a on a.project_id = tr.project_id
      where tr.id = technician_report_order_forms.technician_report_id
        and a.assigned_technician_id = (select auth.uid())
    )
  )
);
