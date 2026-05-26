-- Status vor automatischem Sprung auf «abgemacht» (Termin gebucht), für Rückfall wenn letzter Termin gelöscht wird.
alter table public.projects
  add column if not exists status_revert_on_appointment_clear text;

comment on column public.projects.status_revert_on_appointment_clear is
  'Vorheriger Projektstatus vor appointment_automation → abgemacht; wird bei manuellem Status-Update geleert.';
