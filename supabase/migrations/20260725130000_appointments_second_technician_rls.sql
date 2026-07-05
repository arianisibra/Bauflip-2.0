-- Zwei Monteure pro Termin: jede Policy, die bisher nur `assigned_technician_id`
-- gegen auth.uid() prüft, bekommt zusätzlich `assigned_technician_id_2` additiv (OR).

-- appointments.appointments_read_by_role
drop policy if exists "appointments_read_by_role" on public.appointments;

create policy "appointments_read_by_role"
on public.appointments
for select
using (
  public.current_user_role() in ('office', 'admin')
  or assigned_technician_id = (select auth.uid())
  or assigned_technician_id_2 = (select auth.uid())
);

-- technician_reports.technician_reports_read
drop policy if exists "technician_reports_read" on public.technician_reports;

create policy "technician_reports_read"
on public.technician_reports
for select
using (
  public.current_user_role() in ('office', 'admin')
  or created_by = (select auth.uid())
  or (
    public.current_user_role() = 'technician'
    and exists (
      select 1
      from public.projects p
      where p.id = technician_reports.project_id
        and (
          p.next_owner_user_id = (select auth.uid())
          or exists (
            select 1
            from public.appointments a
            where a.project_id = p.id
              and (
                a.assigned_technician_id = (select auth.uid())
                or a.assigned_technician_id_2 = (select auth.uid())
              )
          )
        )
    )
  )
);

-- technician_reports.technician_reports_update_technician_own_project
drop policy if exists "technician_reports_update_technician_own_project" on public.technician_reports;

create policy "technician_reports_update_technician_own_project"
on public.technician_reports
for update
using (
  public.current_user_role() = 'technician'
  and technician_reports.created_by = (select auth.uid())
  and exists (
    select 1
    from public.projects p
    where p.id = technician_reports.project_id
      and (
        p.next_owner_user_id = (select auth.uid())
        or exists (
          select 1
          from public.appointments a
          where a.project_id = p.id
            and (
              a.assigned_technician_id = (select auth.uid())
              or a.assigned_technician_id_2 = (select auth.uid())
            )
        )
      )
  )
)
with check (
  public.current_user_role() = 'technician'
  and technician_reports.created_by = (select auth.uid())
  and exists (
    select 1
    from public.projects p
    where p.id = technician_reports.project_id
      and (
        p.next_owner_user_id = (select auth.uid())
        or exists (
          select 1
          from public.appointments a
          where a.project_id = p.id
            and (
              a.assigned_technician_id = (select auth.uid())
              or a.assigned_technician_id_2 = (select auth.uid())
            )
        )
      )
  )
);

-- project_attachments.attachments_read
drop policy if exists "attachments_read" on public.project_attachments;

create policy "attachments_read"
on public.project_attachments
for select
using (
  public.current_user_role() in ('office', 'admin')
  or exists (
    select 1
    from public.projects p
    where p.id = project_attachments.project_id
      and p.next_owner_user_id = (select auth.uid())
  )
  or (
    public.current_user_role() = 'technician'
    and exists (
      select 1
      from public.appointments a
      where a.project_id = project_attachments.project_id
        and (
          a.assigned_technician_id = (select auth.uid())
          or a.assigned_technician_id_2 = (select auth.uid())
        )
    )
  )
);

-- projects.projects_read_role_based
drop policy if exists "projects_read_role_based" on public.projects;

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
          and (
            a.assigned_technician_id = (select auth.uid())
            or a.assigned_technician_id_2 = (select auth.uid())
          )
      )
    )
  )
);

-- projects.projects_update_role_based
drop policy if exists "projects_update_role_based" on public.projects;

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
          and (
            a.assigned_technician_id = (select auth.uid())
            or a.assigned_technician_id_2 = (select auth.uid())
          )
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
          and (
            a.assigned_technician_id = (select auth.uid())
            or a.assigned_technician_id_2 = (select auth.uid())
          )
      )
    )
  )
);

-- technician_report_order_forms.report_order_forms_select
drop policy if exists "report_order_forms_select" on public.technician_report_order_forms;

create policy "report_order_forms_select"
on public.technician_report_order_forms
for select
using (
  public.current_user_role() in ('office', 'admin')
  or exists (
    select 1
    from public.technician_reports tr
    where tr.id = technician_report_order_forms.technician_report_id
      and tr.created_by = (select auth.uid())
  )
  or (
    public.current_user_role() = 'technician'
    and exists (
      select 1
      from public.technician_reports tr
      join public.projects p on p.id = tr.project_id
      where tr.id = technician_report_order_forms.technician_report_id
        and (
          p.next_owner_user_id = (select auth.uid())
          or exists (
            select 1
            from public.appointments a
            where a.project_id = p.id
              and (
                a.assigned_technician_id = (select auth.uid())
                or a.assigned_technician_id_2 = (select auth.uid())
              )
          )
        )
    )
  )
);

-- technician_report_order_forms.report_order_forms_insert
drop policy if exists "report_order_forms_insert" on public.technician_report_order_forms;

create policy "report_order_forms_insert"
on public.technician_report_order_forms
for insert
with check (
  (
    public.current_user_role() in ('office', 'admin')
    and exists (
      select 1
      from public.technician_reports tr
      join public.projects p on p.id = tr.project_id
      join public.organization_memberships om
        on om.organization_id = p.organization_id
       and om.user_id = (select auth.uid())
       and om.is_active
      where tr.id = technician_report_order_forms.technician_report_id
    )
  )
  or
  (
    public.current_user_role() = 'technician'
    and exists (
      select 1
      from public.technician_reports tr
      join public.appointments a on a.project_id = tr.project_id
      where tr.id = technician_report_order_forms.technician_report_id
        and (
          a.assigned_technician_id = (select auth.uid())
          or a.assigned_technician_id_2 = (select auth.uid())
        )
    )
  )
);

-- technician_report_order_forms.report_order_forms_delete
drop policy if exists "report_order_forms_delete" on public.technician_report_order_forms;

create policy "report_order_forms_delete"
on public.technician_report_order_forms
for delete
using (
  (
    public.current_user_role() in ('office', 'admin')
    and exists (
      select 1
      from public.technician_reports tr
      join public.projects p on p.id = tr.project_id
      join public.organization_memberships om
        on om.organization_id = p.organization_id
       and om.user_id = (select auth.uid())
       and om.is_active
      where tr.id = technician_report_order_forms.technician_report_id
    )
  )
  or
  (
    public.current_user_role() = 'technician'
    and exists (
      select 1
      from public.technician_reports tr
      join public.appointments a on a.project_id = tr.project_id
      where tr.id = technician_report_order_forms.technician_report_id
        and (
          a.assigned_technician_id = (select auth.uid())
          or a.assigned_technician_id_2 = (select auth.uid())
        )
    )
  )
);

-- Hinweis: `project_chat_messages` existiert nicht mehr — wurde bereits in
-- 20260407090645_downsize_core.sql per `drop table ... cascade` entfernt.
-- Keine Policy dafür nötig.
