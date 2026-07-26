-- Kalender-Sync raus: Termine in den persönlichen Google/Microsoft-Kalender
-- des Monteurs pushen. Pro Person höchstens eine Verbindung je Provider;
-- pro (Termin, Person, Provider) höchstens ein verknüpftes externes Event.

create table if not exists public.technician_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  sync_error text,
  connected_at timestamptz not null default now(),
  unique (technician_id, provider)
);

alter table public.technician_calendar_connections enable row level security;

drop policy if exists "own calendar connection" on public.technician_calendar_connections;
create policy "own calendar connection" on public.technician_calendar_connections
  for all
  using (technician_id = auth.uid())
  with check (technician_id = auth.uid());

create table if not exists public.appointment_calendar_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  technician_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  external_event_id text not null,
  created_at timestamptz not null default now(),
  unique (appointment_id, technician_id, provider)
);

-- Nur der Server (Service-Role, im Anschluss an Termin-Mutationen) schreibt hier;
-- kein Client-Zugriff nötig — RLS aktiv, aber bewusst ohne Policy (deny-all für
-- normale Rollen, Service-Role umgeht RLS ohnehin).
alter table public.appointment_calendar_events enable row level security;

create index if not exists appointment_calendar_events_appointment_id_idx
  on public.appointment_calendar_events (appointment_id);
