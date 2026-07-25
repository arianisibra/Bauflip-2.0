alter table public.quotes
  add column if not exists discount_percent numeric(5, 2) not null default 0;

alter table public.invoices
  add column if not exists discount_percent numeric(5, 2) not null default 0;

comment on column public.quotes.discount_percent is
  'Prozentualer Rabatt auf die Positionssumme, VOR der MwSt abgezogen (0 = kein Rabatt).';
comment on column public.invoices.discount_percent is
  'Prozentualer Rabatt auf die Positionssumme, VOR der MwSt abgezogen (0 = kein Rabatt).';
