-- Dokument-Metadaten für PDF-Generierung und Finalisierung

alter table public.quotes
  add column if not exists pdf_path text,
  add column if not exists pdf_generated_at timestamptz,
  add column if not exists pdf_version integer not null default 0,
  add column if not exists finalized_at timestamptz,
  add column if not exists finalized_by uuid references public.profiles(id) on delete set null;

alter table public.invoices
  add column if not exists pdf_path text,
  add column if not exists pdf_generated_at timestamptz,
  add column if not exists pdf_version integer not null default 0,
  add column if not exists finalized_at timestamptz,
  add column if not exists finalized_by uuid references public.profiles(id) on delete set null;

alter table public.deliveries
  add column if not exists pdf_path text,
  add column if not exists pdf_generated_at timestamptz,
  add column if not exists pdf_version integer not null default 0,
  add column if not exists finalized_at timestamptz,
  add column if not exists finalized_by uuid references public.profiles(id) on delete set null;
