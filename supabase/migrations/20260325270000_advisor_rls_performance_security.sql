-- Supabase Database Advisor:
-- - auth_rls_initplan: (select auth.uid()) in RLS
-- - multiple_permissive_policies: one SELECT policy per table (split admin FOR ALL)
-- - unindexed_foreign_keys: covering indexes on FK columns
-- - function_search_path_mutable: touch_updated_at (re-applied; 20260325113000 overwrote prior fix)
-- - rls_enabled_no_policy: internal counter tables — no client access via RLS

-- touch_updated_at was recreated without search_path in 20260325113000_auth_org_memberships_invites.sql
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (auth_rls_initplan)
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_self_or_admin_insert" on public.profiles;
create policy "profiles_self_or_admin_insert"
on public.profiles
for insert
with check (id = (select auth.uid()) or public.current_user_role() = 'admin');

drop policy if exists "profiles_self_or_admin_update" on public.profiles;
create policy "profiles_self_or_admin_update"
on public.profiles
for update
using (id = (select auth.uid()) or public.current_user_role() = 'admin')
with check (id = (select auth.uid()) or public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- organizations (initplan + multiple permissive SELECT)
-- ---------------------------------------------------------------------------
drop policy if exists "organizations_member_read" on public.organizations;
drop policy if exists "organizations_admin_manage" on public.organizations;

create policy "organizations_select"
on public.organizations
for select
using (
  public.current_user_role() = 'admin'
  or exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = organizations.id
      and m.user_id = (select auth.uid())
      and m.is_active = true
  )
);

create policy "organizations_admin_insert"
on public.organizations
for insert
with check (public.current_user_role() = 'admin');

create policy "organizations_admin_update"
on public.organizations
for update
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "organizations_admin_delete"
on public.organizations
for delete
using (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- organization_memberships (initplan + multiple permissive SELECT)
-- ---------------------------------------------------------------------------
drop policy if exists "memberships_self_read" on public.organization_memberships;
drop policy if exists "memberships_admin_manage" on public.organization_memberships;

create policy "memberships_select"
on public.organization_memberships
for select
using (
  user_id = (select auth.uid())
  or (
    public.current_user_role() = 'admin'
    and organization_id = public.current_organization_id()
  )
);

create policy "memberships_admin_insert"
on public.organization_memberships
for insert
with check (
  public.current_user_role() = 'admin'
  and organization_id = public.current_organization_id()
);

create policy "memberships_admin_update"
on public.organization_memberships
for update
using (
  public.current_user_role() = 'admin'
  and organization_id = public.current_organization_id()
)
with check (
  public.current_user_role() = 'admin'
  and organization_id = public.current_organization_id()
);

create policy "memberships_admin_delete"
on public.organization_memberships
for delete
using (
  public.current_user_role() = 'admin'
  and organization_id = public.current_organization_id()
);

-- ---------------------------------------------------------------------------
-- calendar_provider_tokens (auth_rls_initplan)
-- ---------------------------------------------------------------------------
drop policy if exists "calendar_provider_tokens_select_own" on public.calendar_provider_tokens;
drop policy if exists "calendar_provider_tokens_insert_own" on public.calendar_provider_tokens;
drop policy if exists "calendar_provider_tokens_update_own" on public.calendar_provider_tokens;
drop policy if exists "calendar_provider_tokens_delete_own" on public.calendar_provider_tokens;

create policy "calendar_provider_tokens_select_own"
on public.calendar_provider_tokens for select
using (profile_id = (select auth.uid()));

create policy "calendar_provider_tokens_insert_own"
on public.calendar_provider_tokens for insert
with check (profile_id = (select auth.uid()));

create policy "calendar_provider_tokens_update_own"
on public.calendar_provider_tokens for update
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "calendar_provider_tokens_delete_own"
on public.calendar_provider_tokens for delete
using (profile_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- article_categories (multiple permissive SELECT: FOR ALL + technician read)
-- ---------------------------------------------------------------------------
drop policy if exists "technician_read_article_categories" on public.article_categories;
drop policy if exists "admin_office_article_categories" on public.article_categories;

create policy "article_categories_select"
on public.article_categories for select
using (
  public.current_user_role() in ('admin', 'office')
  or public.current_user_role() = 'technician'
);

create policy "article_categories_insert"
on public.article_categories for insert
with check (public.current_user_role() in ('admin', 'office'));

create policy "article_categories_update"
on public.article_categories for update
using (public.current_user_role() in ('admin', 'office'))
with check (public.current_user_role() in ('admin', 'office'));

create policy "article_categories_delete"
on public.article_categories for delete
using (public.current_user_role() in ('admin', 'office'));

-- ---------------------------------------------------------------------------
-- site_properties & project_work_types (multiple permissive SELECT)
-- ---------------------------------------------------------------------------
drop policy if exists "technician_read_site_properties" on public.site_properties;
drop policy if exists "office_admin_read_site_properties" on public.site_properties;

create policy "site_properties_select"
on public.site_properties for select
using (public.current_user_role() in ('office', 'admin', 'technician'));

drop policy if exists "technician_read_project_work_types" on public.project_work_types;
drop policy if exists "office_admin_read_project_work_types" on public.project_work_types;

create policy "project_work_types_select"
on public.project_work_types for select
using (public.current_user_role() in ('office', 'admin', 'technician'));

-- ---------------------------------------------------------------------------
-- Foreign keys without covering index (added after early FK-index migration)
-- ---------------------------------------------------------------------------
create index if not exists articles_article_category_id_fkey_idx
  on public.articles (article_category_id);

create index if not exists invitations_invited_by_fkey_idx
  on public.invitations (invited_by);

create index if not exists organizations_created_by_fkey_idx
  on public.organizations (created_by);

create index if not exists projects_billing_address_id_fkey_idx
  on public.projects (billing_address_id);

create index if not exists projects_contact_person_id_fkey_idx
  on public.projects (contact_person_id);

create index if not exists projects_service_address_id_fkey_idx
  on public.projects (service_address_id);

-- ---------------------------------------------------------------------------
-- Internal counters: only SECURITY DEFINER trigger should touch these
-- ---------------------------------------------------------------------------
alter table public.contact_kunden_counters disable row level security;
alter table public.contact_kunden_counter_null_org disable row level security;
