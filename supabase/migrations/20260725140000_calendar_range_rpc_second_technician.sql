-- Zwei Monteure pro Termin: zweiter Profil-Join + Felder, Filter matcht auch Monteur 2
-- (sonst sieht Monteur 2 den gemeinsamen Termin nicht in "Mein Tag"/Wochenplan).

create or replace function public.calendar_range_tasks_for_org(
  p_range_start timestamptz,
  p_range_end timestamptz,
  p_technician_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'appointmentId', a.id,
        'startsAt', a.starts_at,
        'endsAt', a.ends_at,
        'kind', a.kind::text,
        'projectId', a.project_id,
        'projectTitle', coalesce(nullif(trim(p.tenant_name), ''), nullif(trim(p.title), '')),
        'projectStatus', p.status::text,
        'assignedTechnicianId', a.assigned_technician_id,
        'technicianName', pr.display_name,
        'calendarColor', pr.calendar_color,
        'assignedTechnicianId2', a.assigned_technician_id_2,
        'technicianName2', pr2.display_name,
        'calendarColor2', pr2.calendar_color,
        'tenantDisplay', nullif(trim(p.tenant_name), ''),
        'serviceStreet', p.service_street,
        'servicePostalCode', p.service_postal_code,
        'serviceCity', p.service_city
      )
      order by a.starts_at asc
    ),
    '[]'::jsonb
  )
  from public.appointments a
  inner join public.projects p on p.id = a.project_id
  left join public.profiles pr on pr.id = a.assigned_technician_id
  left join public.profiles pr2 on pr2.id = a.assigned_technician_id_2
  where a.starts_at >= p_range_start
    and a.starts_at <= p_range_end
    and (
      p_technician_id is null
      or a.assigned_technician_id = p_technician_id
      or a.assigned_technician_id_2 = p_technician_id
    )
    and coalesce(nullif(trim(p.tenant_name), ''), nullif(trim(p.title), '')) is not null;
$$;

comment on function public.calendar_range_tasks_for_org is
  'Office/tech calendar: appointments in range with project + up to two technicians (RLS via security invoker).';
