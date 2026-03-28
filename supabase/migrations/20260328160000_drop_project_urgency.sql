-- Dringlichkeit/Priorität am Projekt wird nicht mehr genutzt.
alter table public.projects drop column if exists urgency;
