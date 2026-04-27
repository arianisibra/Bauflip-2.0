-- Monteur am Projekt (Termin-Zuweisung / next_owner) soll alle Rapporte des Projekts lesen,
-- nicht nur eigene — sonst fehlen frühere Bestellformulare vor der Montage.

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
              and a.assigned_technician_id = (select auth.uid())
          )
        )
    )
  )
);

-- Ausgefüllte Bestellformulare: gleiche Sicht wie Rapport (nicht nur Urheber-Rapport).

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
              and a.assigned_technician_id = (select auth.uid())
          )
        )
    )
  )
);
