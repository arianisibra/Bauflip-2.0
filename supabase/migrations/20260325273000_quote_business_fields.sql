-- Erweiterte Offerten-Felder inkl. kaufmännischer Summen und Textbausteine
alter table public.quotes
  add column if not exists warranty_text text,
  add column if not exists validity_days integer,
  add column if not exists lead_time_text text,
  add column if not exists down_payment_percent numeric(5,2),
  add column if not exists payment_terms_text text,
  add column if not exists salutation_text text,
  add column if not exists text_blocks text,
  add column if not exists currency text not null default 'CHF',
  add column if not exists discount_percent numeric(5,2) not null default 0,
  add column if not exists vat_percent numeric(5,2) not null default 8.1,
  add column if not exists subtotal_net numeric(12,2) not null default 0,
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists total_net numeric(12,2) not null default 0,
  add column if not exists vat_amount numeric(12,2) not null default 0,
  add column if not exists total_gross numeric(12,2) not null default 0;
