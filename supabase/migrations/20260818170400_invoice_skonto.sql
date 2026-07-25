alter table public.invoices
  add column if not exists skonto_percent numeric(5, 2) not null default 0,
  add column if not exists skonto_days integer not null default 0;

comment on column public.invoices.skonto_percent is
  'Skonto-Satz (%) bei Zahlung innert skonto_days — rein informativ auf dem PDF, mindert NICHT total_gross (offiziell geschuldeter Betrag bleibt unverändert; der Zahlungsabgleich behandelt frühzeitige Skonto-Zahlungen separat).';
comment on column public.invoices.skonto_days is
  'Zahlungsfrist in Tagen, innerhalb der der Skonto-Satz gilt (0 = kein Skonto).';
