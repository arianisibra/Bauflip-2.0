-- Phase Mit-DB: team + absences in one roundtrip for /mitarbeiter SSR bootstrap.

create or replace function public.mitarbeiter_office_bootstrap(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_org uuid := public.current_organization_id();
begin
  if v_org is null or v_org is distinct from p_org_id then
    return jsonb_build_object('team', '[]'::jsonb, 'absences', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'team',
    coalesce(
      (
        select jsonb_agg(entry order by sort_at nulls last)
        from (
          select
            jsonb_build_object(
              'key', 'member:' || om.user_id::text,
              'userId', om.user_id,
              'displayName', coalesce(
                nullif(trim(p.display_name), ''),
                nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
                'Mitarbeiter'
              ),
              'email', coalesce(u.email, '—'),
              'role', om.role::text,
              'status', 'aktiv',
              'createdAt', om.created_at,
              'avatarUrl', nullif(trim(p.avatar_url), '')
            ) as entry,
            om.created_at as sort_at
          from public.organization_memberships om
          inner join public.profiles p on p.id = om.user_id
          left join auth.users u on u.id = om.user_id
          where om.organization_id = p_org_id
            and om.is_active = true
          union all
          select
            jsonb_build_object(
              'key', 'invite:' || i.id::text,
              'userId', null,
              'displayName', coalesce(nullif(split_part(i.email, '@', 1), ''), 'Einladung'),
              'email', i.email,
              'role', i.role::text,
              'status', 'eingeladen',
              'createdAt', i.created_at,
              'avatarUrl', null
            ),
            i.created_at
          from public.invitations i
          where i.organization_id = p_org_id
            and i.accepted_at is null
            and i.revoked_at is null
        ) combined
      ),
      '[]'::jsonb
    ),
    'absences',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', a.id,
            'technicianId', a.technician_id,
            'technicianName', pr.display_name,
            'startsAt', a.starts_at,
            'endsAt', a.ends_at,
            'kind', a.kind::text,
            'note', a.note,
            'createdAt', a.created_at
          )
          order by a.starts_at desc
        )
        from public.technician_absences a
        left join public.profiles pr on pr.id = a.technician_id
        where a.organization_id = p_org_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

comment on function public.mitarbeiter_office_bootstrap is
  'Office /mitarbeiter: active members + pending invites + absences (RLS via org check + security definer auth.users).';

grant execute on function public.mitarbeiter_office_bootstrap(uuid) to authenticated;
