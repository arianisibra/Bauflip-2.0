-- Zweiter Sicherheitsaudit (2026-08-30), niedrig: syncBusyCalendar loeschte
-- und fuegte den Cache in zwei getrennten Anweisungen ein. Zwei gleichzeitige
-- Sync-Laeufe fuer denselben Techniker (z. B. Cron + manueller "Jetzt
-- synchronisieren"-Button) konnten sich verschraenken: beide loeschen, beide
-- fuegen ein — Ergebnis sind doppelte Sperrzeiten. Fix: eine
-- SECURITY-DEFINER-Funktion, die per Transaktions-Advisory-Lock auf den
-- Techniker serialisiert und Loeschen+Einfuegen in EINER Transaktion macht.

begin;

create or replace function public.sync_technician_busy_events(
  p_technician_id uuid,
  p_organization_id uuid,
  p_intervals jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  -- Serialisiert konkurrierende Sync-Laeufe fuer DENSELBEN Techniker; die
  -- Sperre gilt nur fuer die Dauer dieser Transaktion und wird beim Commit/
  -- Rollback automatisch freigegeben.
  perform pg_advisory_xact_lock(hashtextextended(p_technician_id::text, 0));

  delete from public.technician_busy_events where technician_id = p_technician_id;

  insert into public.technician_busy_events (technician_id, organization_id, starts_at, ends_at)
  select
    p_technician_id,
    p_organization_id,
    (elem->>'starts_at')::timestamptz,
    (elem->>'ends_at')::timestamptz
  from jsonb_array_elements(p_intervals) as elem;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.sync_technician_busy_events(uuid, uuid, jsonb) is
  'Ersetzt den Busy-Cache eines Technikers atomar (Advisory-Lock + eine Transaktion) — verhindert doppelte Sperrzeiten bei gleichzeitigen Sync-Laeufen.';

-- Nur Service-Role ruft diese Funktion auf (lib/db/busy-calendar.ts nutzt
-- den Admin-Client) — kein Client-Zugriff noetig.
revoke all on function public.sync_technician_busy_events(uuid, uuid, jsonb) from public, anon, authenticated;

commit;
