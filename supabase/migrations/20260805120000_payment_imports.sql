-- Zahlungsabgleich (camt-Import): Protokoll-Tabelle. Die hochgeladene Datei selbst
-- wird nie gespeichert (In-Memory geparst) — nur eine Zusammenfassung pro Import,
-- damit nachvollziehbar bleibt, wer wann welche Datei mit welchem Ergebnis eingelesen hat.
--
-- invoices.paid_at existiert bereits (20260803120000_invoices.sql).

create table if not exists public.payment_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  filename text not null,
  imported_by uuid references public.profiles(id) on delete set null,
  imported_by_display_name text,
  entries_total integer not null default 0,
  entries_matched integer not null default 0,
  entries_already_paid integer not null default 0,
  entries_amount_mismatch integer not null default 0,
  entries_unmatched integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.payment_imports is
  'Protokoll je camt-Import (Zahlungsabgleich): Zusammenfassung, nicht die Datei selbst.';

create index if not exists idx_payment_imports_org_created
  on public.payment_imports (organization_id, created_at desc);

alter table public.payment_imports enable row level security;

drop policy if exists "payment_imports_all_office_admin_org" on public.payment_imports;
create policy "payment_imports_all_office_admin_org"
on public.payment_imports
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
