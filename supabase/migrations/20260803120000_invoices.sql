-- Rechnungen (R2): invoices + invoice_line_items mit Nummernkreis RE-JJJJ-NNNN je Org.
-- Muster identisch zu quotes (20260727120000) — inkl. der Advisor-Härtungen von
-- Anfang an (Lektion aus dem Audit: RLS-Deny auf Counter, revoke auf Trigger-RPC).
--
-- Org-Scoping über organization_memberships-Join (nicht current_organization_id).

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  invoice_number text,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'paid', 'cancelled')),
  due_date date,
  intro_text text,
  vat_rate numeric(4,2) not null default 8.1 check (vat_rate >= 0 and vat_rate <= 100),
  total_net numeric(12,2) not null default 0,
  total_gross numeric(12,2) not null default 0,
  reference_type text not null default 'NON'
    check (reference_type in ('QRR', 'SCOR', 'NON')),
  payment_reference text,
  sent_at timestamptz,
  sent_to_email text,
  paid_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.invoices is
  'Rechnungen je Projekt (QR-Rechnung); Nummer je Organisation/Jahr per Trigger, Referenz bei Erstellung eingefroren.';

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position integer not null default 1,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit text,
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.invoice_line_items is
  'Positionen einer Rechnung (Menge × Einheitspreis = line_total, App-seitig berechnet).';

create index if not exists idx_invoices_project on public.invoices (project_id);
create index if not exists idx_invoices_org_created on public.invoices (organization_id, created_at desc);
create index if not exists idx_invoices_quote on public.invoices (quote_id);
create index if not exists idx_invoices_created_by on public.invoices (created_by);
create unique index if not exists idx_invoices_number_unique
  on public.invoices (organization_id, invoice_number)
  where invoice_number is not null;
create index if not exists idx_invoice_line_items_invoice on public.invoice_line_items (invoice_id, position);

drop trigger if exists invoices_touch_updated_at on public.invoices;
create trigger invoices_touch_updated_at
before update on public.invoices
for each row execute function public.touch_updated_at();

-- Nummernkreis: interne Tabelle, kein API-Zugriff (Deny-Policy statt RLS-off).
create table if not exists public.invoice_number_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  year integer not null,
  next_number integer not null,
  primary key (organization_id, year)
);

alter table public.invoice_number_counters enable row level security;

drop policy if exists "invoice_number_counters_no_rest" on public.invoice_number_counters;
create policy "invoice_number_counters_no_rest"
on public.invoice_number_counters
for all
to anon, authenticated
using (false)
with check (false);

revoke all on public.invoice_number_counters from public;
revoke all on public.invoice_number_counters from anon;
revoke all on public.invoice_number_counters from authenticated;

create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  y integer;
  n integer;
begin
  if new.invoice_number is not null and btrim(new.invoice_number) <> '' then
    return new;
  end if;

  y := extract(year from coalesce(new.created_at, now()))::integer;

  insert into public.invoice_number_counters (organization_id, year, next_number)
  values (new.organization_id, y, 1001)
  on conflict (organization_id, year)
  do update set next_number = public.invoice_number_counters.next_number + 1
  returning next_number - 1 into n;

  new.invoice_number := 'RE-' || y::text || '-' || n::text;
  return new;
end;
$$;

revoke all on function public.assign_invoice_number() from public;
revoke all on function public.assign_invoice_number() from anon;
revoke all on function public.assign_invoice_number() from authenticated;
grant execute on function public.assign_invoice_number() to postgres;
grant execute on function public.assign_invoice_number() to service_role;

drop trigger if exists invoices_assign_number on public.invoices;
create trigger invoices_assign_number
before insert on public.invoices
for each row
execute function public.assign_invoice_number();

-- RLS: Office/Admin der eigenen Organisation.
alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;

drop policy if exists "invoices_all_office_admin_org" on public.invoices;
create policy "invoices_all_office_admin_org"
on public.invoices
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

drop policy if exists "invoice_line_items_all_office_admin_org" on public.invoice_line_items;
create policy "invoice_line_items_all_office_admin_org"
on public.invoice_line_items
for all
using (
  exists (
    select 1
    from public.invoices i
    where i.id = invoice_id
      and public.current_user_role() in ('admin', 'office')
      and i.organization_id in (
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
    from public.invoices i
    where i.id = invoice_id
      and public.current_user_role() in ('admin', 'office')
      and i.organization_id in (
        select om.organization_id
        from public.organization_memberships om
        where om.user_id = (select auth.uid())
          and om.is_active
      )
  )
);
