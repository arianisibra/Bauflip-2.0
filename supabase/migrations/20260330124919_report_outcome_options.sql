create table if not exists public.report_outcome_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  value text not null,
  is_deletable boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique (organization_id, value)
);

create index if not exists idx_report_outcome_options_org
  on public.report_outcome_options (organization_id, sort_order);

insert into public.report_outcome_options (organization_id, label, value, is_deletable, sort_order)
select o.id, x.label, x.value, false, x.ord
from public.organizations o
cross join (
  values
    ('Direkt gelöst (Reparatur sofort)', 'direkt_geloest',       10),
    ('Ersatzteil nötig',                 'ersatzteil_noetig',    20),
    ('Demontage → Werkstatt',            'werkstatt_noetig',     30),
    ('Komplettersatz nötig',             'vollersatz_noetig',    40)
) as x(label, value, ord)
on conflict (organization_id, value) do nothing;

alter table public.report_outcome_options enable row level security;

create policy "report_outcome_options_select"
  on public.report_outcome_options for select
  using (public.current_user_role() in ('office', 'admin', 'technician'));

create policy "report_outcome_options_insert"
  on public.report_outcome_options for insert
  with check (public.current_user_role() in ('office', 'admin'));

create policy "report_outcome_options_delete"
  on public.report_outcome_options for delete
  using (public.current_user_role() in ('office', 'admin') and is_deletable = true);
