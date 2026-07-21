-- ICS-Gegenrichtung: privater Kalender als Busy-Blocker. Jede/r Mitarbeiter/in kann
-- eine geheime iCal-Abo-URL hinterlegen; ein Sync holt die belegten Zeiten und legt
-- sie gecacht ab, damit die Terminplanung Überschneidungen als WARNUNG anzeigt.
--
-- Privatsphäre: die geheime URL sieht NUR die Person selbst; gecacht werden nur
-- Zeitfenster (kein Titel/Inhalt) — das Büro sieht «belegt», nicht was.

-- Config: geheime Feed-URL + Status. Nur der Eigentümer liest/ändert seine Zeile.
create table if not exists public.technician_busy_calendar (
  technician_id uuid primary key references public.profiles (id) on delete cascade,
  ics_url text,
  enabled boolean not null default false,
  synced_at timestamptz,
  sync_error text,
  updated_at timestamptz not null default now()
);

comment on table public.technician_busy_calendar is
  'Privater Kalender-Feed (iCal) je Mitarbeiter als Busy-Blocker. URL ist geheim → nur Eigentümer.';

alter table public.technician_busy_calendar enable row level security;

drop policy if exists "busy_calendar_own" on public.technician_busy_calendar;
create policy "busy_calendar_own"
on public.technician_busy_calendar
for all
to authenticated
using (technician_id = (select auth.uid()))
with check (technician_id = (select auth.uid()));

drop trigger if exists technician_busy_calendar_touch_updated_at on public.technician_busy_calendar;
create trigger technician_busy_calendar_touch_updated_at
before update on public.technician_busy_calendar
for each row execute function public.touch_updated_at();

-- Gecachte Busy-Zeiten (nur Zeiten, KEIN Titel). Wird bei jedem Sync ersetzt.
create table if not exists public.technician_busy_events (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.technician_busy_events is
  'Gecachte Busy-Zeitfenster aus dem privaten Kalender (ohne Titel). Nur Zeiten für die Planung.';

create index if not exists idx_busy_events_tech_range
  on public.technician_busy_events (technician_id, starts_at, ends_at);
create index if not exists idx_busy_events_org_range
  on public.technician_busy_events (organization_id, starts_at, ends_at);

alter table public.technician_busy_events enable row level security;

-- Lesen: eigene Zeiten immer; Büro/Admin der eigenen Org fürs Planen. Schreiben nur
-- über service_role (Sync-Job) → keine insert/update/delete-Policy für API-Rollen.
drop policy if exists "busy_events_read" on public.technician_busy_events;
create policy "busy_events_read"
on public.technician_busy_events
for select
to authenticated
using (
  technician_id = (select auth.uid())
  or (
    public.current_user_role() in ('admin', 'office')
    and organization_id in (
      select om.organization_id
      from public.organization_memberships om
      where om.user_id = (select auth.uid())
        and om.is_active
    )
  )
);
