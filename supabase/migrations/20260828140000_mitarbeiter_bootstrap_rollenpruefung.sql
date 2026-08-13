-- H3: mitarbeiter_office_bootstrap prüfte nur die Organisation, nicht die Rolle.
--
-- Die Funktion ist SECURITY DEFINER und umgeht damit RLS. Sie liefert alle
-- Mitglieder samt E-Mail aus auth.users, deren Rollen und Avatare, dazu alle
-- offenen Einladungen mit E-Mail und vorgesehener Rolle sowie sämtliche
-- Abwesenheiten. Genau diese Daten sperrt die RLS sonst: profiles_select_access
-- gibt nur das eigene Profil frei, invitations_admin_manage verlangt Admin.
--
-- Ein Monteur konnte die Funktion mit seiner eigenen Organisations-UUID direkt
-- über PostgREST aufrufen und erhielt eine vollständige Belegschaftsliste mit
-- E-Mail-Adressen — eine fertige Zielliste für Phishing.
--
-- Behoben: Rollenprüfung im Rumpf, konsistent zur Berechtigung der Seite
-- /mitarbeiter (Büro und Admin). Bei fehlender Berechtigung wird dieselbe leere
-- Struktur zurückgegeben wie bei falscher Organisation — die Funktion verrät
-- also nicht, ob die Organisation existiert.
--
-- Bewusst NICHT geändert: Büro-Nutzer sehen weiterhin offene Einladungen der
-- eigenen Organisation, obwohl invitations_admin_manage strenger ist. Das ist
-- eine Inkonsistenz, aber kein Mandantenleck — und eine Einschränkung wäre eine
-- funktionale Änderung, die gesondert entschieden gehört.

create or replace function public.mitarbeiter_office_bootstrap(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_org uuid := public.current_organization_id();
begin
  -- Organisation UND Rolle prüfen. Ohne die Rollenprüfung umging jeder Monteur
  -- die RLS auf profiles, auth.users und invitations.
  if v_org is null
     or v_org is distinct from p_org_id
     or public.current_user_role() not in ('office'::app_role, 'admin'::app_role)
  then
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
$function$;

-- Postgres vergibt EXECUTE an PUBLIC per Default. anon braucht die Funktion nie.
revoke execute on function public.mitarbeiter_office_bootstrap(uuid) from public, anon;
grant execute on function public.mitarbeiter_office_bootstrap(uuid) to authenticated;
