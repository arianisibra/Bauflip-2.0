create table if not exists public.report_select_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  field_key text not null,
  label text not null,
  value text not null,
  is_deletable boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique (organization_id, field_key, value)
);

create index if not exists idx_report_select_options_org_field
  on public.report_select_options (organization_id, field_key, sort_order);

insert into public.report_select_options (organization_id, field_key, label, value, is_deletable, sort_order)
select o.id, 'ort', x.label, x.value, false, x.ord
from public.organizations o
cross join (
  values
    ('Balkon',           'balkon',         10),
    ('Balkon Südseite',  'balkon_sued',    20),
    ('Balkon Nordseite', 'balkon_nord',    30),
    ('Terrasse',         'terrasse',       40),
    ('Terrasse Südseite','terrasse_sued',  50),
    ('Fenster',          'fenster',        60),
    ('Fassade',          'fassade',        70),
    ('Wintergarten',     'wintergarten',   80),
    ('Sitzplatz',        'sitzplatz',      90),
    ('Innenbereich',     'innenbereich',  100)
) as x(label, value, ord)
on conflict (organization_id, field_key, value) do nothing;

alter table public.report_select_options enable row level security;

create policy "report_select_options_select"
  on public.report_select_options for select
  using (public.current_user_role() in ('office', 'admin', 'technician'));

create policy "report_select_options_insert"
  on public.report_select_options for insert
  with check (public.current_user_role() in ('office', 'admin'));

create policy "report_select_options_delete"
  on public.report_select_options for delete
  using (public.current_user_role() in ('office', 'admin') and is_deletable = true);
