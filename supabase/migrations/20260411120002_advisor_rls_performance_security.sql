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
drop policy if exists "organizations_select" on public.organizations;
drop policy if exists "organizations_admin_insert" on public.organizations;
drop policy if exists "organizations_admin_update" on public.organizations;
drop policy if exists "organizations_admin_delete" on public.organizations;
drop policy if exists "organizations_admin_manage_insert" on public.organizations;
drop policy if exists "organizations_admin_manage_update" on public.organizations;
drop policy if exists "organizations_admin_manage_delete" on public.organizations;

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

-- Admin nur INSERT/UPDATE/DELETE — kein FOR ALL (FOR ALL gilt auch für SELECT und verdoppelt organizations_select / Lint 0006).
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
drop policy if exists "memberships_select" on public.organization_memberships;
drop policy if exists "memberships_admin_insert" on public.organization_memberships;
drop policy if exists "memberships_admin_update" on public.organization_memberships;
drop policy if exists "memberships_admin_delete" on public.organization_memberships;

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
do $block$
begin
  if to_regclass('public.calendar_provider_tokens') is not null then
    execute 'drop policy if exists "calendar_provider_tokens_select_own" on public.calendar_provider_tokens';
    execute 'drop policy if exists "calendar_provider_tokens_insert_own" on public.calendar_provider_tokens';
    execute 'drop policy if exists "calendar_provider_tokens_update_own" on public.calendar_provider_tokens';
    execute 'drop policy if exists "calendar_provider_tokens_delete_own" on public.calendar_provider_tokens';
    execute $p$
      create policy "calendar_provider_tokens_select_own"
      on public.calendar_provider_tokens for select
      using (profile_id = (select auth.uid()))
    $p$;
    execute $p$
      create policy "calendar_provider_tokens_insert_own"
      on public.calendar_provider_tokens for insert
      with check (profile_id = (select auth.uid()))
    $p$;
    execute $p$
      create policy "calendar_provider_tokens_update_own"
      on public.calendar_provider_tokens for update
      using (profile_id = (select auth.uid()))
      with check (profile_id = (select auth.uid()))
    $p$;
    execute $p$
      create policy "calendar_provider_tokens_delete_own"
      on public.calendar_provider_tokens for delete
      using (profile_id = (select auth.uid()))
    $p$;
  end if;
end
$block$;

-- ---------------------------------------------------------------------------
-- article_categories (Tabelle kann durch downsize_core fehlen)
-- ---------------------------------------------------------------------------
do $block$
begin
  if to_regclass('public.article_categories') is not null then
    execute 'drop policy if exists "technician_read_article_categories" on public.article_categories';
    execute 'drop policy if exists "admin_office_article_categories" on public.article_categories';
    execute 'drop policy if exists "article_categories_select" on public.article_categories';
    execute 'drop policy if exists "article_categories_insert" on public.article_categories';
    execute 'drop policy if exists "article_categories_update" on public.article_categories';
    execute 'drop policy if exists "article_categories_delete" on public.article_categories';
    execute $p$
      create policy "article_categories_select"
      on public.article_categories for select
      using (
        public.current_user_role() in ('admin', 'office')
        or public.current_user_role() = 'technician'
      )
    $p$;
    execute $p$
      create policy "article_categories_insert"
      on public.article_categories for insert
      with check (public.current_user_role() in ('admin', 'office'))
    $p$;
    execute $p$
      create policy "article_categories_update"
      on public.article_categories for update
      using (public.current_user_role() in ('admin', 'office'))
      with check (public.current_user_role() in ('admin', 'office'))
    $p$;
    execute $p$
      create policy "article_categories_delete"
      on public.article_categories for delete
      using (public.current_user_role() in ('admin', 'office'))
    $p$;
  end if;
end
$block$;

-- ---------------------------------------------------------------------------
-- site_properties & project_work_types (nur wenn Tabellen noch existieren — downsize_core kann sie entfernt haben)
-- ---------------------------------------------------------------------------
do $block$
begin
  if to_regclass('public.site_properties') is not null then
    execute 'drop policy if exists "technician_read_site_properties" on public.site_properties';
    execute 'drop policy if exists "office_admin_read_site_properties" on public.site_properties';
    execute 'drop policy if exists "site_properties_select" on public.site_properties';
    execute $p$
      create policy "site_properties_select"
      on public.site_properties for select
      using (public.current_user_role() in ('office', 'admin', 'technician'))
    $p$;
  end if;
  if to_regclass('public.project_work_types') is not null then
    execute 'drop policy if exists "technician_read_project_work_types" on public.project_work_types';
    execute 'drop policy if exists "office_admin_read_project_work_types" on public.project_work_types';
    execute 'drop policy if exists "project_work_types_select" on public.project_work_types';
    execute $p$
      create policy "project_work_types_select"
      on public.project_work_types for select
      using (public.current_user_role() in ('office', 'admin', 'technician'))
    $p$;
  end if;
end
$block$;

-- ---------------------------------------------------------------------------
-- Foreign keys without covering index (nur wenn Spalte noch existiert)
-- ---------------------------------------------------------------------------
do $block$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'articles' and column_name = 'article_category_id'
  ) then
    execute 'create index if not exists articles_article_category_id_fkey_idx on public.articles (article_category_id)';
  end if;
  -- invited_by / created_by: idx_* kommt aus 20260410130937_fk_covering_indexes — kein zweites identisches *_fkey_idx (0009 duplicate_index).
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'projects' and column_name = 'billing_address_id'
  ) then
    execute 'create index if not exists projects_billing_address_id_fkey_idx on public.projects (billing_address_id)';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'projects' and column_name = 'contact_person_id'
  ) then
    execute 'create index if not exists projects_contact_person_id_fkey_idx on public.projects (contact_person_id)';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'projects' and column_name = 'service_address_id'
  ) then
    execute 'create index if not exists projects_service_address_id_fkey_idx on public.projects (service_address_id)';
  end if;
end
$block$;

-- ---------------------------------------------------------------------------
-- Internal counters: nur wenn Tabellen noch existieren
-- ---------------------------------------------------------------------------
do $block$
begin
  if to_regclass('public.contact_kunden_counters') is not null then
    execute 'alter table public.contact_kunden_counters disable row level security';
  end if;
  if to_regclass('public.contact_kunden_counter_null_org') is not null then
    execute 'alter table public.contact_kunden_counter_null_org disable row level security';
  end if;
end
$block$;
