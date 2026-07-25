-- Textbausteine: wiederverwendbare Textblöcke (Titel + Text) je Organisation,
-- wählbar für Einleitungstext/Schlusstext auf Offerten und Rechnungen.
-- Gleiches Muster wie price_book_items (Org-Scoping über organization_memberships).
--
-- Zusätzlich: Rechnungen bekommen ein Schlusstext-Feld (footer_text), analog zum
-- bereits bestehenden outro_text auf quotes.

create table if not exists public.text_snippets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  body text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.text_snippets is
  'Textbausteine: wiederverwendbare Textblöcke (Titel + Text) für Einleitungs-/Schlusstext auf Offerten/Rechnungen.';

create index if not exists idx_text_snippets_org_sort
  on public.text_snippets (organization_id, is_active, sort_order, title);

drop trigger if exists text_snippets_touch_updated_at on public.text_snippets;
create trigger text_snippets_touch_updated_at
before update on public.text_snippets
for each row execute function public.touch_updated_at();

alter table public.text_snippets enable row level security;

drop policy if exists "text_snippets_all_office_admin_org" on public.text_snippets;
create policy "text_snippets_all_office_admin_org"
on public.text_snippets
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

alter table public.invoices
  add column if not exists footer_text text;
