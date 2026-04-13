-- Hot paths from query insights: organization_memberships by (user_id, is_active) with ORDER BY created_at,
-- and list-by-org with role filter. Covering indexes reduce heap fetches and sort work.
-- Replaces narrower indexes that are prefixes of these access patterns.

drop index if exists public.idx_memberships_user_active;
drop index if exists public.idx_memberships_org_active;

create index if not exists idx_memberships_user_active_created_at
  on public.organization_memberships (user_id, is_active, created_at asc)
  include (role, organization_id);

create index if not exists idx_memberships_org_active_role
  on public.organization_memberships (organization_id, is_active, role)
  include (user_id);

-- PostgREST: contacts ordered by name (only if table still exists, e.g. branch not on downsize_core).
do $$
begin
  if to_regclass('public.contacts') is not null then
    create index if not exists idx_contacts_org_name
      on public.contacts (organization_id, name asc);
  end if;
end $$;
