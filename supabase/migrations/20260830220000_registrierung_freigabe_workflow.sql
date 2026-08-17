-- Freigabe-Workflow für Selbstregistrierung: die Firma wird bei der
-- Registrierung normal angelegt, bleibt aber auf approval_status='pending'
-- bis der Betreiber sie über einen per Mail verschickten Capability-Link
-- freigibt oder ablehnt. Bestehende Firmen werden auf 'approved' migriert,
-- damit sich am Zugriff bestehender Kunden nichts ändert.

begin;

alter table public.organizations
  add column if not exists approval_status text not null default 'approved'
    check (approval_status in ('pending', 'approved', 'rejected')),
  add column if not exists approval_token text,
  add column if not exists approval_requested_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text;

comment on column public.organizations.approval_status is
  'pending = wartet auf Freigabe durch den Betreiber (Selbstregistrierung); approved = freigeschaltet; rejected = abgelehnt. Bestand vor diesem Feature ist approved.';
comment on column public.organizations.approval_token is
  'Einmal-Capability-Token für den Freigabe-/Ablehnungs-Link in der Benachrichtigungsmail — wird nach der Entscheidung geleert (Token ist selbst die Authentisierung, analog intake_email_token).';

create unique index if not exists organizations_approval_token_unique
  on public.organizations (approval_token)
  where approval_token is not null;

-- ---------------------------------------------------------------------------
-- Spaltenrechte haerten: OHNE dies koennte der frisch registrierte Admin der
-- eigenen (noch wartenden) Firma sich selbst per direktem PostgREST-PATCH
-- freigeben — organizations_admin_update erlaubt Admins bereits das Schreiben
-- auf die eigene Org-Zeile, die Spaltenebene muss den Freigabe-Status also
-- zusaetzlich sperren. Tabellen-Grant zuerst entziehen (Postgres-Falle: ein
-- Spalten-revoke allein bleibt wirkungslos, solange der Tabellen-Grant
-- besteht), dann exakt die Spalten neu vergeben, die der Anwendungscode
-- tatsaechlich per Nutzer-Client schreibt (grep-geprueft: lib/db/onboarding.ts,
-- lib/db/intake-email.ts, lib/db/bexio.ts, lib/db/billing.ts,
-- app/(app)/einstellungen/actions.ts).
-- ---------------------------------------------------------------------------
revoke update on public.organizations from authenticated, anon;

grant update (
  name,
  logo_url,
  onboarding_completed_at,
  intake_email_token,
  bexio_connected_at,
  bexio_tax_id,
  bexio_account_id,
  billing_iban,
  billing_creditor_name,
  billing_creditor_street,
  billing_creditor_building_number,
  billing_creditor_postal_code,
  billing_creditor_city,
  billing_vat_number,
  billing_phone,
  billing_email,
  billing_website
) on public.organizations to authenticated;

-- approval_token ist ein Capability-Secret — nicht per SELECT fuer die eigene
-- (wartende) Firma lesbar, sonst koennte sich der Registrant selbst freigeben.
revoke select on public.organizations from authenticated, anon;

-- anon erfuellt organizations_select ohnehin nie (auth.uid() ist null, keine
-- Mitgliedschaft moeglich) — Grant bewusst nur an authenticated, kein
-- ungenutzter Anon-Grant mehr wie zuvor.
grant select (
  id, name, created_at, created_by, logo_url,
  billing_iban, billing_creditor_name, billing_creditor_street,
  billing_creditor_postal_code, billing_creditor_city, billing_creditor_building_number,
  billing_vat_number, bexio_tax_id, bexio_account_id, bexio_connected_at,
  onboarding_completed_at, billing_phone, billing_email, billing_website,
  intake_email_token,
  approval_status, approval_requested_at, approved_at, approved_by,
  rejected_at, rejection_reason
) on public.organizations to authenticated;

commit;
