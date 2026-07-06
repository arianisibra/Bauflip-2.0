-- Preisstamm (Offerten Phase 4): wiederverwendbare Positionen (Material/Leistungen)
-- je Organisation für schnelles Erfassen von Offert-Positionen.
-- Desk-Feature: nur Office/Admin der eigenen Organisation.
--
-- Org-Scoping über direkten organization_memberships-Join (wie quotes/time_entries),
-- NICHT über current_organization_id() (Mehrfach-Org-Problematik).

create table if not exists public.price_book_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  unit text,
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.price_book_items is
  'Preisstamm: wiederverwendbare Offert-Positionen (Name, Einheit, Einheitspreis) je Organisation.';

create index if not exists idx_price_book_items_org_sort
  on public.price_book_items (organization_id, is_active, sort_order, name);

drop trigger if exists price_book_items_touch_updated_at on public.price_book_items;
create trigger price_book_items_touch_updated_at
before update on public.price_book_items
for each row execute function public.touch_updated_at();

alter table public.price_book_items enable row level security;

drop policy if exists "price_book_items_all_office_admin_org" on public.price_book_items;
create policy "price_book_items_all_office_admin_org"
on public.price_book_items
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
