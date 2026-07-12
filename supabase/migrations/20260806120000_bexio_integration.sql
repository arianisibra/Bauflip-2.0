-- Bexio-Anbindung (Teil B, Modell A): Bauflip bleibt Rechnungssteller, Bexio bekommt
-- nach Versand einen Push der fertigen Rechnung als Beleg (siehe docs/PLAN-zahlungen-bexio.md).
--
-- organization_secrets: generische Deny-all-Tabelle für externe API-Tokens. Kein RLS-Zugriff
-- für anon/authenticated — nur der Service-Role-Client (lib/supabase/admin.ts) liest/schreibt.
-- Der Token erreicht so nie den Browser; das Einstellungs-Feld bleibt write-only.

create table if not exists public.organization_secrets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_by_display_name text,
  unique (organization_id, key)
);

comment on table public.organization_secrets is
  'Deny-all: nur Service-Role-Zugriff (lib/supabase/admin.ts). Externe API-Tokens (z. B. Bexio) — nie clientseitig lesbar.';

alter table public.organization_secrets enable row level security;

drop policy if exists "organization_secrets_no_rest" on public.organization_secrets;
create policy "organization_secrets_no_rest"
on public.organization_secrets
for all
to anon, authenticated
using (false)
with check (false);

revoke all on public.organization_secrets from public;
revoke all on public.organization_secrets from anon;
revoke all on public.organization_secrets from authenticated;

-- Mapping (nicht sensibel, org-scoped RLS via bestehende organizations-Policy) + Status.
alter table public.organizations
  add column if not exists bexio_tax_id integer,
  add column if not exists bexio_account_id integer,
  add column if not exists bexio_connected_at timestamptz;

comment on column public.organizations.bexio_tax_id is
  'Bexio Steuersatz-ID (tax_id) für Rechnungspositionen — Mapping in Einstellungen (Teil B2).';
comment on column public.organizations.bexio_account_id is
  'Bexio Ertragskonto-ID (account_id) für Rechnungspositionen — Mapping in Einstellungen (Teil B2).';
comment on column public.organizations.bexio_connected_at is
  'Zeitpunkt des letzten erfolgreichen Bexio-Verbindungstests (Token gültig).';

alter table public.projects
  add column if not exists bexio_contact_id integer;

comment on column public.projects.bexio_contact_id is
  'Bexio-Kontakt-ID (contact_id) — gematcht oder automatisch angelegt beim ersten Rechnungs-Push (Teil B2).';

alter table public.invoices
  add column if not exists bexio_invoice_id integer,
  add column if not exists bexio_synced_at timestamptz,
  add column if not exists bexio_sync_error text;

comment on column public.invoices.bexio_invoice_id is
  'Bexio kb_invoice-ID nach erfolgreichem Push — Idempotenz-Schlüssel (kein Doppel-Push, Teil B3).';
comment on column public.invoices.bexio_synced_at is
  'Zeitpunkt des letzten erfolgreichen Bexio-Push.';
comment on column public.invoices.bexio_sync_error is
  'Fehlermeldung des letzten fehlgeschlagenen Bexio-Push (best-effort, blockiert Rechnungsversand nie).';
