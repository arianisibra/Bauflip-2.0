-- Supabase linter 0006_multiple_permissive_policies: one permissive UPDATE policy instead of two
-- (office_admin_update_projects + technician_update_assigned_projects).
-- Semantics: office/admin unchanged; technician branch matches projects_read_role_based (assigned / next_owner).

drop policy if exists "office_admin_update_projects" on public.projects;
drop policy if exists "technician_update_assigned_projects" on public.projects;

create policy "projects_update_role_based"
on public.projects
for update
using (
  public.current_user_role() in ('office', 'admin')
  or (
    public.current_user_role() = 'technician'
    and (
      next_owner_user_id = (select auth.uid())
      or exists (
        select 1
        from public.appointments a
        where a.project_id = projects.id
          and a.assigned_technician_id = (select auth.uid())
      )
    )
  )
)
with check (
  public.current_user_role() in ('office', 'admin')
  or (
    public.current_user_role() = 'technician'
    and (
      next_owner_user_id = (select auth.uid())
      or exists (
        select 1
        from public.appointments a
        where a.project_id = projects.id
          and a.assigned_technician_id = (select auth.uid())
      )
    )
  )
);
