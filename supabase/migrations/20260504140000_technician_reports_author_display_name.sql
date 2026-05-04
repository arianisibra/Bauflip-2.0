-- Anzeigename des Rapport-Erfaassers: denormalisiert, damit Büro/Monteur den Urheber
-- sehen kann, ohne fremde profiles-Zeilen lesen zu müssen (RLS).

alter table public.technician_reports
  add column if not exists created_by_display_name text;

comment on column public.technician_reports.created_by_display_name is
  'Snapshot des Anzeigenamens bei Erfassung (profiles.display_name); für Anzeige & Historie.';

update public.technician_reports tr
set created_by_display_name = p.display_name
from public.profiles p
where tr.created_by = p.id
  and (tr.created_by_display_name is null or tr.created_by_display_name = '');
