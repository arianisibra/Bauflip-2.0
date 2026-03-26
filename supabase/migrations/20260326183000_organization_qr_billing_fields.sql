alter table public.organizations
  add column if not exists billing_iban text,
  add column if not exists billing_creditor_name text,
  add column if not exists billing_creditor_street text,
  add column if not exists billing_creditor_postal_code text,
  add column if not exists billing_creditor_city text;

comment on column public.organizations.billing_iban is 'IBAN für QR-Rechnungen.';
comment on column public.organizations.billing_creditor_name is 'Gläubigername für QR-Rechnungen.';
comment on column public.organizations.billing_creditor_street is 'Gläubigerstrasse für QR-Rechnungen.';
comment on column public.organizations.billing_creditor_postal_code is 'Gläubiger-PLZ für QR-Rechnungen.';
comment on column public.organizations.billing_creditor_city is 'Gläubiger-Ort für QR-Rechnungen.';
