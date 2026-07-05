-- Zwei Monteure pro Termin: zweite optionale Monteur-Zuweisung.

alter table public.appointments
  add column if not exists assigned_technician_id_2 uuid references public.profiles(id) on delete set null;

create index if not exists idx_appointments_tech2_starts
  on public.appointments (assigned_technician_id_2, starts_at);
