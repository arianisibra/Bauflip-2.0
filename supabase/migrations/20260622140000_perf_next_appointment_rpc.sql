-- Next appointment per project for office project list (ends_at >= now).
create index if not exists idx_appointments_ends_at on public.appointments (ends_at);

create or replace function public.next_appointment_starts_for_org(
  p_org_id uuid,
  p_now timestamptz default now()
)
returns table (
  project_id uuid,
  starts_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (a.project_id)
    a.project_id,
    a.starts_at
  from public.appointments a
  inner join public.projects p on p.id = a.project_id
  where p.organization_id = p_org_id
    and a.ends_at >= p_now
  order by a.project_id, a.starts_at asc;
$$;

grant execute on function public.next_appointment_starts_for_org(uuid, timestamptz) to authenticated;
