-- Monteur: eigenen Rapport bearbeiten (UPDATE), Projekt-Sicht wie bei technician_reports_read.

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
            and a.assigned_technician_id = (select auth.uid())
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
            and a.assigned_technician_id = (select auth.uid())
        )
      )
  )
);

-- INSERT Bestellzeilen: bisher nur mit Termin-Zuweisung; ergänzt next_owner (wie Projekt-Lese-RLS).
create policy "report_order_forms_insert_technician_next_owner"
on public.technician_report_order_forms
for insert
with check (
  public.current_user_role() = 'technician'
  and exists (
    select 1
    from public.technician_reports tr
    join public.projects p on p.id = tr.project_id
    where tr.id = technician_report_order_forms.technician_report_id
      and tr.created_by = (select auth.uid())
      and p.next_owner_user_id = (select auth.uid())
  )
);

-- DELETE Bestellzeilen beim Ersetzen: next_owner + eigener Rapport (Termin-Pfad existierte schon separat).
create policy "report_order_forms_delete_technician_next_owner_own"
on public.technician_report_order_forms
for delete
using (
  public.current_user_role() = 'technician'
  and exists (
    select 1
    from public.technician_reports tr
    join public.projects p on p.id = tr.project_id
    where tr.id = technician_report_order_forms.technician_report_id
      and tr.created_by = (select auth.uid())
      and p.next_owner_user_id = (select auth.uid())
  )
);
