-- Round 2: Kern-only — keine separaten Notiz-Zeilen, keine ungenutzten Textspalten.

drop table if exists public.project_notes cascade;

drop type if exists public.note_type;

alter table public.projects
  drop column if exists key_handling_notes,
  drop column if exists timing_notes,
  drop column if exists internal_notes,
  drop column if exists technician_notes;

alter table public.appointments
  drop column if exists access_notes,
  drop column if exists key_handling_notes;
