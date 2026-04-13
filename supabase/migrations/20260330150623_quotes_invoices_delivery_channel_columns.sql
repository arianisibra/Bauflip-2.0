-- Versandmetadaten für Offerte und Rechnung
alter table public.quotes
  add column if not exists delivery_channel text,
  add column if not exists delivery_sent_at timestamptz,
  add column if not exists delivery_recipient text;

alter table public.invoices
  add column if not exists delivery_channel text,
  add column if not exists delivery_sent_at timestamptz,
  add column if not exists delivery_recipient text;
