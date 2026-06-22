-- Phase 2e: partial index for default «active» list + combined bootstrap RPC (page 1 + status counts).

create index if not exists idx_projects_org_created_active
  on public.projects (organization_id, created_at desc, id desc)
  where status <> 'abgeschlossen';

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
  v_projects jsonb := '[]'::jsonb;
  v_has_more boolean := false;
  v_last_created_at timestamptz;
  v_last_id uuid;
  v_row record;
  v_filtered_count bigint := 0;
begin
  for v_row in
    select p.status::text as status, count(*)::bigint as cnt
    from public.projects p
    where p.organization_id = p_org_id
    group by p.status
  loop
    v_by_status := v_by_status || jsonb_build_object(v_row.status, v_row.cnt);
    v_total_all := v_total_all + v_row.cnt;
    if v_row.status <> 'abgeschlossen' then
      v_total_active := v_total_active + v_row.cnt;
    end if;
  end loop;

  if v_filter = 'abgemacht' then
    return jsonb_build_object(
      'statusCounts', jsonb_build_object(
        'byStatus', v_by_status,
        'totalAll', v_total_all,
        'totalActive', v_total_active
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
      and (
        (v_filter in ('active', 'all') and p.status <> 'abgeschlossen')
        or (v_filter not in ('active', 'all') and p.status::text = v_filter)
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
      'totalActive', v_total_active
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
