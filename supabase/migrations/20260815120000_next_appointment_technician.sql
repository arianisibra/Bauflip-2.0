-- Projektliste zeigt künftig «Nächster Termin · Monteur» direkt in der Zeile.
-- Die RPC liefert dafür zusätzlich den Monteur-Namen (bei 2 Monteuren mit «+1»).
-- Rückwärtskompatibel: Argumente unverändert, bestehende Spalten bleiben — Alt-Code
-- (main) liest weiterhin nur project_id/starts_at und ignoriert die neue Spalte.

drop function if exists public.next_appointment_starts_for_org(uuid, timestamptz);

create function public.next_appointment_starts_for_org(
  p_org_id uuid,
  p_now timestamptz default now()
)
returns table (
  project_id uuid,
  starts_at timestamptz,
  technician_name text
)
language sql
stable
security invoker
set search_path = public
as $$
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
  order by a.project_id, a.starts_at asc;
$$;

grant execute on function public.next_appointment_starts_for_org(uuid, timestamptz) to authenticated;
