-- Kundensignatur am Rapport (Phase 5): Unterschrift als PNG-Data-URL direkt in der
-- Zeile (klein, ~10–50 KB) — vermeidet Storage-/Signing-Aufwand für ein Signaturbild.

alter table public.technician_reports
  add column if not exists signature_data_url text,
  add column if not exists signed_by_name text;

comment on column public.technician_reports.signature_data_url is
  'Kundenunterschrift als data:image/png-URL (Canvas-Export, App-seitig auf 400 KB begrenzt).';
comment on column public.technician_reports.signed_by_name is
  'Name der unterzeichnenden Person (Freitext).';
