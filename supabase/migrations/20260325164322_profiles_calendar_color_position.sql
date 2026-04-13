alter table public.profiles
  add column if not exists calendar_color text,
  add column if not exists calendar_position integer not null default 0;

comment on column public.profiles.calendar_color is 'Kalenderfarbe (Hex, z. B. #0ea5e9) für Termine / Übersicht.';
comment on column public.profiles.calendar_position is 'Reihenfolge in der Team-Legende (kleinere Zahl zuerst).';
