create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role app_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role app_role not null,
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '72 hours'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_memberships_user_active
  on public.organization_memberships(user_id, is_active);

create index if not exists idx_memberships_org_active
  on public.organization_memberships(organization_id, is_active);

create index if not exists idx_invitations_org_email_open
  on public.invitations(organization_id, lower(email))
  where accepted_at is null and revoked_at is null;

create unique index if not exists uq_invitations_open_per_org_email
  on public.invitations(organization_id, lower(email))
  where accepted_at is null and revoked_at is null;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.organization_id
  from public.organization_memberships m
  where m.user_id = auth.uid()
    and m.is_active = true
  order by m.created_at asc
  limit 1
$$;

create or replace function public.current_user_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select m.role
      from public.organization_memberships m
      where m.user_id = auth.uid()
        and m.is_active = true
      order by m.created_at asc
      limit 1
    ),
    (auth.jwt() -> 'app_metadata' ->> 'role')::app_role,
    (select role from public.profiles where id = auth.uid()),
    'office'::app_role
  )
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_memberships_updated_at on public.organization_memberships;
create trigger trg_memberships_updated_at
before update on public.organization_memberships
for each row
execute function public.touch_updated_at();

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.invitations enable row level security;

drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_self_or_admin_insert"
on public.profiles
for insert
with check (id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_self_or_admin_update"
on public.profiles
for update
using (id = auth.uid() or public.current_user_role() = 'admin')
with check (id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists "organizations_member_read" on public.organizations;
create policy "organizations_member_read"
on public.organizations
for select
using (
  exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = organizations.id
      and m.user_id = auth.uid()
      and m.is_active = true
  )
);

drop policy if exists "organizations_admin_manage" on public.organizations;
create policy "organizations_admin_manage"
on public.organizations
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "memberships_self_read" on public.organization_memberships;
create policy "memberships_self_read"
on public.organization_memberships
for select
using (
  user_id = auth.uid()
  or (
    public.current_user_role() = 'admin'
    and organization_id = public.current_organization_id()
  )
);

drop policy if exists "memberships_admin_manage" on public.organization_memberships;
create policy "memberships_admin_manage"
on public.organization_memberships
for all
using (
  public.current_user_role() = 'admin'
  and organization_id = public.current_organization_id()
)
with check (
  public.current_user_role() = 'admin'
  and organization_id = public.current_organization_id()
);

drop policy if exists "invitations_admin_manage" on public.invitations;
create policy "invitations_admin_manage"
on public.invitations
for all
using (
  public.current_user_role() = 'admin'
  and organization_id = public.current_organization_id()
)
with check (
  public.current_user_role() = 'admin'
  and organization_id = public.current_organization_id()
);
