-- next_appointment_starts_for_org um einen optionalen Projektfilter erweitern.
--
-- Die Funktion lieferte den nächsten Termin ALLER Projekte der Organisation.
-- Die Projektliste braucht aber nur die angezeigten Zeilen und filterte den
-- Rest hinterher im Speicher weg — bei 520 Projekten auch dann, wenn eine
-- einzige Zeile dargestellt wird.
--
-- Der neue Parameter ist optional: Ohne Liste bleibt das Verhalten exakt wie
-- bisher (organisationsweit). Der ältere Codestand auf `main` ruft die Funktion
-- weiterhin nur mit Organisation und Zeitpunkt auf und ist damit unberührt.
--
-- ACHTUNG, Postgres-Falle: `create or replace function` mit einem ZUSÄTZLICHEN
-- Parameter ersetzt nicht, sondern legt eine ÜBERLADUNG an. Danach ist der
-- bisherige Aufruf mehrdeutig ("function is not unique") und schlägt fehl —
-- auch für die Live-App. Deshalb muss die alte Signatur ausdrücklich weg.

create or replace function public.next_appointment_starts_for_org(
  p_org_id uuid,
  p_now timestamp with time zone default now(),
  p_project_ids uuid[] default null
)
returns table(project_id uuid, starts_at timestamp with time zone, technician_name text)
language sql
stable
set search_path to 'public'
as $function$
  select distinct on (a.project_id)
    a.project_id,
    a.starts_at,
    case
      when pr.display_name is null then null
      when a.assigned_technician_id_2 is not null then pr.display_name || ' +1'
      else pr.display_name
    end as technician_name
  from public.appointments a
  inner join public.projects p on p.id = a.project_id
  left join public.profiles pr on pr.id = a.assigned_technician_id
  where p.organization_id = p_org_id
    and a.ends_at >= p_now
    and (p_project_ids is null or a.project_id = any(p_project_ids))
  order by a.project_id, a.starts_at asc;
$function$;

-- Alte Signatur entfernen, sonst bleibt jeder Aufruf mehrdeutig.
drop function if exists public.next_appointment_starts_for_org(uuid, timestamp with time zone);

revoke execute on function public.next_appointment_starts_for_org(uuid, timestamptz, uuid[]) from public, anon;
grant execute on function public.next_appointment_starts_for_org(uuid, timestamptz, uuid[]) to authenticated;
