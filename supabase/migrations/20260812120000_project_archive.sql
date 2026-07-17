-- Projekt-Archivierung: Soft-Archive statt Hard-Delete, damit versehentlich
-- "gelöschte" Projekte wiederherstellbar sind (Kundenwunsch — echter Datenverlust
-- war das Problem). archived_at = null bedeutet aktiv; gesetzt = archiviert.
-- Endgültiges Löschen bleibt möglich (Admin), ist aber ein bewusster Extra-Schritt.

alter table public.projects
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

-- Aktive Liste/Zähler filtern auf archived_at is null — Teilindex hält das schnell.
create index if not exists idx_projects_org_active_not_archived
  on public.projects (organization_id, created_at desc)
  where archived_at is null;

-- Archiv-Ansicht: Projekte je Org nach Archivierungszeitpunkt.
create index if not exists idx_projects_org_archived
  on public.projects (organization_id, archived_at desc)
  where archived_at is not null;

-- Listen-RPC erweitern: aktive Liste + Zähler blenden Archivierte aus; neuer
-- Meta-Filter 'archived' zeigt nur archivierte; Zähler 'totalArchived' ergänzt.
create or replace function public.projekte_office_bootstrap(
  p_org_id uuid,
  p_filter text default 'active',
  p_search text default null,
  p_limit int default 50
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_filter text := coalesce(nullif(trim(p_filter), ''), 'active');
  v_search text := nullif(trim(p_search), '');
  v_limit int := greatest(coalesce(p_limit, 50), 1);
  v_pattern text;
  v_by_status jsonb := '{}'::jsonb;
  v_total_all bigint := 0;
  v_total_active bigint := 0;
  v_total_archived bigint := 0;
  v_projects jsonb := '[]'::jsonb;
  v_has_more boolean := false;
  v_last_created_at timestamptz;
  v_last_id uuid;
  v_row record;
  v_filtered_count bigint := 0;
begin
  -- Zähler: aktive (nicht archivierte) Projekte je Status; archivierte separat.
  for v_row in
    select p.status::text as status, count(*)::bigint as cnt
    from public.projects p
    where p.organization_id = p_org_id and p.archived_at is null
    group by p.status
  loop
    v_by_status := v_by_status || jsonb_build_object(v_row.status, v_row.cnt);
    v_total_all := v_total_all + v_row.cnt;
    if v_row.status <> 'abgeschlossen' then
      v_total_active := v_total_active + v_row.cnt;
    end if;
  end loop;

  select count(*)::bigint into v_total_archived
  from public.projects p
  where p.organization_id = p_org_id and p.archived_at is not null;

  -- «abgemacht» nutzt eine eigene, termin-sortierte RPC — nur ohne Suche.
  if v_filter = 'abgemacht' and v_search is null then
    return jsonb_build_object(
      'statusCounts', jsonb_build_object(
        'byStatus', v_by_status,
        'totalAll', v_total_all,
        'totalActive', v_total_active,
        'totalArchived', v_total_archived
      ),
      'projects', '[]'::jsonb,
      'hasMore', false,
      'lastCreatedAt', null,
      'lastId', null,
      'deferred', true
    );
  end if;

  if v_search is not null then
    v_pattern := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with filtered as (
    select
      p.id,
      p.title,
      p.type::text as type,
      p.status::text as status,
      p.tenant_name,
      p.created_at
    from public.projects p
    where p.organization_id = p_org_id
      and (
        v_search is null
        or p.title ilike v_pattern escape '\'
        or p.tenant_name ilike v_pattern escape '\'
        or p.service_street ilike v_pattern escape '\'
        or p.service_city ilike v_pattern escape '\'
        or p.service_postal_code ilike v_pattern escape '\'
        or p.reference_code ilike v_pattern escape '\'
      )
      -- Archiv-Trennung: Filter 'archived' zeigt nur archivierte, sonst nur aktive.
      and case when v_filter = 'archived' then p.archived_at is not null else p.archived_at is null end
      and (
        v_search is not null                                       -- Suche aktiv → statusweit
        or v_filter in ('all', 'archived')                         -- «Alle»/Archiv: kein Status-Filter
        or (v_filter = 'active' and p.status <> 'abgeschlossen')
        or (v_filter not in ('active', 'all', 'archived') and p.status::text = v_filter)
      )
    order by p.created_at desc, p.id desc
    limit v_limit + 1
  )
  select
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', fr.id,
            'title', fr.title,
            'type', fr.type,
            'status', fr.status,
            'tenant_name', fr.tenant_name,
            'created_at', fr.created_at
          )
          order by fr.created_at desc, fr.id desc
        )
        from (select * from filtered limit v_limit) fr
      ),
      '[]'::jsonb
    ),
    (select count(*) > v_limit from filtered),
    (select count(*) from filtered),
    (
      select fr.created_at
      from (select * from filtered limit v_limit) fr
      order by fr.created_at asc, fr.id asc
      limit 1
    ),
    (
      select fr.id
      from (select * from filtered limit v_limit) fr
      order by fr.created_at asc, fr.id asc
      limit 1
    )
  into v_projects, v_has_more, v_filtered_count, v_last_created_at, v_last_id;

  return jsonb_build_object(
    'statusCounts', jsonb_build_object(
      'byStatus', v_by_status,
      'totalAll', v_total_all,
      'totalActive', v_total_active,
      'totalArchived', v_total_archived
    ),
    'projects', v_projects,
    'hasMore', coalesce(v_has_more, false),
    'lastCreatedAt', v_last_created_at,
    'lastId', v_last_id,
    'filteredCount', coalesce(v_filtered_count, 0),
    'deferred', false
  );
end;
$$;

grant execute on function public.projekte_office_bootstrap(uuid, text, text, int) to authenticated;
