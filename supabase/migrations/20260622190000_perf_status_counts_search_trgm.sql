-- Status counts via aggregation (replaces fetching every project.status row).
create or replace function public.project_status_counts_for_org(p_org_id uuid)
returns table (
  status text,
  count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select p.status::text, count(*)::bigint
  from public.projects p
  where p.organization_id = p_org_id
  group by p.status;
$$;

grant execute on function public.project_status_counts_for_org(uuid) to authenticated;

-- Trigram indexes for office project list server search (ilike %term%).
create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_projects_title_trgm
  on public.projects using gin (title extensions.gin_trgm_ops);

create index if not exists idx_projects_tenant_name_trgm
  on public.projects using gin (tenant_name extensions.gin_trgm_ops);

create index if not exists idx_projects_service_street_trgm
  on public.projects using gin (service_street extensions.gin_trgm_ops);

create index if not exists idx_projects_service_city_trgm
  on public.projects using gin (service_city extensions.gin_trgm_ops);

create index if not exists idx_projects_service_postal_code_trgm
  on public.projects using gin (service_postal_code extensions.gin_trgm_ops);

create index if not exists idx_projects_reference_code_trgm
  on public.projects using gin (reference_code extensions.gin_trgm_ops);
