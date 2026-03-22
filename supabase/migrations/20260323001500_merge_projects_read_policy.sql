drop policy if exists "office_admin_read_projects" on public.projects;
drop policy if exists "technician_assigned_projects" on public.projects;

create policy "projects_read_role_based"
on public.projects
for select
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
);
