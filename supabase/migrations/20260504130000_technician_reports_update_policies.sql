-- Rapporte nachträglich bearbeiten (Büro/Admin): UPDATE auf technician_reports;
-- Bestellformular-Zeilen ersetzen: DELETE auf technician_report_order_forms (INSERT existierte bereits).

create policy "technician_reports_update_office_admin"
on public.technician_reports
for update
using (
  public.current_user_role() in ('office', 'admin')
  and exists (
    select 1
    from public.projects p
    join public.organization_memberships om
      on om.organization_id = p.organization_id
     and om.user_id = (select auth.uid())
     and om.is_active
    where p.id = technician_reports.project_id
  )
)
with check (
  public.current_user_role() in ('office', 'admin')
  and exists (
    select 1
    from public.projects p
    join public.organization_memberships om
      on om.organization_id = p.organization_id
     and om.user_id = (select auth.uid())
     and om.is_active
    where p.id = technician_reports.project_id
  )
);

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
        and a.assigned_technician_id = (select auth.uid())
    )
  )
);
