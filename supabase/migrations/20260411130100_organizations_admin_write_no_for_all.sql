-- 0006: organizations_admin_manage FOR ALL deckt auch SELECT ab → zweite permissive Policy neben organizations_select.
-- Ersetze durch INSERT/UPDATE/DELETE-only (semantisch gleicher Admin-Schreibzugriff).

drop policy if exists "organizations_admin_manage" on public.organizations;
drop policy if exists "organizations_admin_manage_insert" on public.organizations;
drop policy if exists "organizations_admin_manage_update" on public.organizations;
drop policy if exists "organizations_admin_manage_delete" on public.organizations;
drop policy if exists "organizations_admin_insert" on public.organizations;
drop policy if exists "organizations_admin_update" on public.organizations;
drop policy if exists "organizations_admin_delete" on public.organizations;

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
