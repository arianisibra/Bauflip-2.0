-- Kalender-Einladungen (iCal per Mail) bei Termin-Buchung: Opt-out je Mitarbeiter.

alter table public.profiles
  add column if not exists appointment_invites_enabled boolean not null default true;

comment on column public.profiles.appointment_invites_enabled is
  'Termin-Einladungen (iCal-Mail) an diese Person senden — abwählbar im Profil.';
