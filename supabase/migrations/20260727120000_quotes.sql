-- Offerten (Phase 1): quotes + quote_line_items mit Nummernkreis pro Organisation/Jahr.
-- Desk-Feature: nur Office/Admin der eigenen Organisation (Monteure brauchen keinen Zugriff).
--
-- Sicherheits-Hinweis: Org-Scoping über direkten organization_memberships-Join
-- (wie time_entries), NICHT über current_organization_id() — dieser Helper liefert
-- nur die erste aktive Mitgliedschaft und würde bei Mehrfach-Org-Mitgliedern falsch scopen.

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  quote_number text,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'approved', 'rejected')),
  valid_until date,
  intro_text text,
  outro_text text,
  vat_rate numeric(4,2) not null default 8.1 check (vat_rate >= 0 and vat_rate <= 100),
  total_net numeric(12,2) not null default 0,
  total_gross numeric(12,2) not null default 0,
  sent_at timestamptz,
  sent_to_email text,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.quotes is
  'Offerten je Projekt (Positionen in quote_line_items); Nummer je Organisation/Jahr per Trigger.';

create table if not exists public.quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  position integer not null default 1,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit text,
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.quote_line_items is
  'Positionen einer Offerte (Menge × Einheitspreis = line_total, App-seitig berechnet).';

create index if not exists idx_quotes_project on public.quotes (project_id);
create index if not exists idx_quotes_org_created on public.quotes (organization_id, created_at desc);
create unique index if not exists idx_quotes_number_unique
  on public.quotes (organization_id, quote_number)
  where quote_number is not null;
create index if not exists idx_quote_line_items_quote on public.quote_line_items (quote_id, position);

drop trigger if exists quotes_touch_updated_at on public.quotes;
create trigger quotes_touch_updated_at
before update on public.quotes
for each row execute function public.touch_updated_at();

-- Nummernkreis: interne Tabelle ohne Client-Zugriff (Muster project_number_counters,
-- aber je Organisation — mandantenfähig).
create table if not exists public.quote_number_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  year integer not null,
  next_number integer not null,
  primary key (organization_id, year)
);

alter table public.quote_number_counters disable row level security;
revoke all on public.quote_number_counters from public;

create or replace function public.assign_quote_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  y integer;
  n integer;
begin
  if new.quote_number is not null and btrim(new.quote_number) <> '' then
    return new;
  end if;

  y := extract(year from coalesce(new.created_at, now()))::integer;

  insert into public.quote_number_counters (organization_id, year, next_number)
  values (new.organization_id, y, 1001)
  on conflict (organization_id, year)
  do update set next_number = public.quote_number_counters.next_number + 1
  returning next_number - 1 into n;

  new.quote_number := 'OF-' || y::text || '-' || n::text;
  return new;
end;
$$;

drop trigger if exists quotes_assign_number on public.quotes;
create trigger quotes_assign_number
before insert on public.quotes
for each row
execute function public.assign_quote_number();

-- RLS: Office/Admin der eigenen Organisation (alle Operationen).
alter table public.quotes enable row level security;
alter table public.quote_line_items enable row level security;

create policy "quotes_all_office_admin_org"
on public.quotes
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

create policy "quote_line_items_all_office_admin_org"
on public.quote_line_items
for all
using (
  exists (
    select 1
    from public.quotes q
    where q.id = quote_id
      and public.current_user_role() in ('admin', 'office')
      and q.organization_id in (
        select om.organization_id
        from public.organization_memberships om
        where om.user_id = (select auth.uid())
          and om.is_active
      )
  )
)
with check (
  exists (
    select 1
    from public.quotes q
    where q.id = quote_id
      and public.current_user_role() in ('admin', 'office')
      and q.organization_id in (
        select om.organization_id
        from public.organization_memberships om
        where om.user_id = (select auth.uid())
          and om.is_active
      )
  )
);
