alter table public.organizations
  add column if not exists billing_phone text,
  add column if not exists billing_email text,
  add column if not exists billing_website text;

comment on column public.organizations.billing_phone is
  'Telefonnummer der Organisation — erscheint im Briefkopf von Offerten/Rechnungen.';
comment on column public.organizations.billing_email is
  'E-Mail-Adresse der Organisation — erscheint im Briefkopf von Offerten/Rechnungen.';
comment on column public.organizations.billing_website is
  'Website der Organisation — erscheint im Briefkopf von Offerten/Rechnungen.';
