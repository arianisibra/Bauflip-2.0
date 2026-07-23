-- KRITISCHER SICHERHEITSFIX: projects/appointments/technician_reports/project_attachments
-- hatten RLS-Policies, die nur die Rolle (office/admin/technician) prüften, aber NIE die
-- Organisation. Jeder office/admin-Account jeder Organisation konnte dadurch alle Projekte,
-- Termine, Rapporte und Anhänge ALLER anderen Organisationen lesen und (bei Projekten/
-- Terminen/Rapporten/Anhängen) auch ändern oder löschen.
--
-- Ursache: diese Policies stammen aus der Zeit, als Storenbau die einzige Organisation war
-- ("irgendein office/admin" war damals zufällig immer "Storenbau"). Seit es eine zweite
-- Organisation gibt (Malerbetrieb Test), ist die Lücke real. Neuere Tabellen (contacts,
-- price_book_items, time_entries, workflow_stages, technician_absences, project_orders)
-- waren nie betroffen — die filtern schon korrekt nach organization_id.
--
-- Live per Browser-Test entdeckt (23. Juli 2026): Kalender der Maler-Test-Org zeigte echte
-- Storenbau-Kundentermine.
--
-- Fix ist rein additiv: bestehende Bedingungen bleiben erhalten, nur ein zusätzliches
-- "UND: Organisation ist eine aktive Mitgliedschaft des Nutzers" wird ergänzt.

-- ── projects ────────────────────────────────────────────────────────────────
drop policy if exists projects_read_role_based on public.projects;
create policy projects_read_role_based on public.projects
  for select
  using (
    (
      (current_user_role() = any (array['office'::app_role, 'admin'::app_role]))
      or (
        current_user_role() = 'technician'::app_role
        and (
          next_owner_user_id = (select auth.uid())
          or exists (
            select 1 from public.appointments a
            where a.project_id = projects.id
              and (a.assigned_technician_id = (select auth.uid()) or a.assigned_technician_id_2 = (select auth.uid()))
          )
        )
      )
    )
    and organization_id in (
      select om.organization_id from public.organization_memberships om
      where om.user_id = (select auth.uid()) and om.is_active
    )
  );

drop policy if exists projects_update_role_based on public.projects;
create policy projects_update_role_based on public.projects
  for update
  using (
    (
      (current_user_role() = any (array['office'::app_role, 'admin'::app_role]))
      or (
        current_user_role() = 'technician'::app_role
        and (
          next_owner_user_id = (select auth.uid())
          or exists (
            select 1 from public.appointments a
            where a.project_id = projects.id
              and (a.assigned_technician_id = (select auth.uid()) or a.assigned_technician_id_2 = (select auth.uid()))
          )
        )
      )
    )
    and organization_id in (
      select om.organization_id from public.organization_memberships om
      where om.user_id = (select auth.uid()) and om.is_active
    )
  )
  with check (
    (
      (current_user_role() = any (array['office'::app_role, 'admin'::app_role]))
      or (
        current_user_role() = 'technician'::app_role
        and (
          next_owner_user_id = (select auth.uid())
          or exists (
            select 1 from public.appointments a
            where a.project_id = projects.id
              and (a.assigned_technician_id = (select auth.uid()) or a.assigned_technician_id_2 = (select auth.uid()))
          )
        )
      )
    )
    and organization_id in (
      select om.organization_id from public.organization_memberships om
      where om.user_id = (select auth.uid()) and om.is_active
    )
  );

drop policy if exists office_admin_insert_projects on public.projects;
create policy office_admin_insert_projects on public.projects
  for insert
  with check (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role]))
    and organization_id in (
      select om.organization_id from public.organization_memberships om
      where om.user_id = (select auth.uid()) and om.is_active
    )
  );

drop policy if exists office_admin_delete_projects on public.projects;
create policy office_admin_delete_projects on public.projects
  for delete
  using (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role]))
    and organization_id in (
      select om.organization_id from public.organization_memberships om
      where om.user_id = (select auth.uid()) and om.is_active
    )
  );

-- ── appointments ────────────────────────────────────────────────────────────
drop policy if exists appointments_read_by_role on public.appointments;
create policy appointments_read_by_role on public.appointments
  for select
  using (
    (
      (current_user_role() = any (array['office'::app_role, 'admin'::app_role]))
      or (assigned_technician_id = (select auth.uid()))
      or (assigned_technician_id_2 = (select auth.uid()))
    )
    and exists (
      select 1 from public.projects p
      join public.organization_memberships om on om.organization_id = p.organization_id
      where p.id = appointments.project_id and om.user_id = (select auth.uid()) and om.is_active
    )
  );

drop policy if exists appointments_insert_office_admin on public.appointments;
create policy appointments_insert_office_admin on public.appointments
  for insert
  with check (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role]))
    and exists (
      select 1 from public.projects p
      join public.organization_memberships om on om.organization_id = p.organization_id
      where p.id = appointments.project_id and om.user_id = (select auth.uid()) and om.is_active
    )
  );

drop policy if exists appointments_update_office_admin on public.appointments;
create policy appointments_update_office_admin on public.appointments
  for update
  using (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role]))
    and exists (
      select 1 from public.projects p
      join public.organization_memberships om on om.organization_id = p.organization_id
      where p.id = appointments.project_id and om.user_id = (select auth.uid()) and om.is_active
    )
  )
  with check (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role]))
    and exists (
      select 1 from public.projects p
      join public.organization_memberships om on om.organization_id = p.organization_id
      where p.id = appointments.project_id and om.user_id = (select auth.uid()) and om.is_active
    )
  );

drop policy if exists appointments_delete_office_admin on public.appointments;
create policy appointments_delete_office_admin on public.appointments
  for delete
  using (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role]))
    and exists (
      select 1 from public.projects p
      join public.organization_memberships om on om.organization_id = p.organization_id
      where p.id = appointments.project_id and om.user_id = (select auth.uid()) and om.is_active
    )
  );

-- ── technician_reports ──────────────────────────────────────────────────────
-- (technician_reports_update_* Policies waren bereits korrekt org-gescoped, unangetastet.)
drop policy if exists technician_reports_read on public.technician_reports;
create policy technician_reports_read on public.technician_reports
  for select
  using (
    (
      (current_user_role() = any (array['office'::app_role, 'admin'::app_role]))
      or (created_by = (select auth.uid()))
      or (
        current_user_role() = 'technician'::app_role
        and exists (
          select 1 from public.projects p
          where p.id = technician_reports.project_id
            and (
              p.next_owner_user_id = (select auth.uid())
              or exists (
                select 1 from public.appointments a
                where a.project_id = p.id
                  and (a.assigned_technician_id = (select auth.uid()) or a.assigned_technician_id_2 = (select auth.uid()))
              )
            )
        )
      )
    )
    and exists (
      select 1 from public.projects p
      join public.organization_memberships om on om.organization_id = p.organization_id
      where p.id = technician_reports.project_id and om.user_id = (select auth.uid()) and om.is_active
    )
  );

drop policy if exists technician_reports_write on public.technician_reports;
create policy technician_reports_write on public.technician_reports
  for insert
  with check (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role, 'technician'::app_role]))
    and exists (
      select 1 from public.projects p
      join public.organization_memberships om on om.organization_id = p.organization_id
      where p.id = technician_reports.project_id and om.user_id = (select auth.uid()) and om.is_active
    )
  );

drop policy if exists admin_delete_technician_reports on public.technician_reports;
create policy admin_delete_technician_reports on public.technician_reports
  for delete
  using (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role]))
    and exists (
      select 1 from public.projects p
      join public.organization_memberships om on om.organization_id = p.organization_id
      where p.id = technician_reports.project_id and om.user_id = (select auth.uid()) and om.is_active
    )
  );

-- ── project_attachments ─────────────────────────────────────────────────────
drop policy if exists attachments_read on public.project_attachments;
create policy attachments_read on public.project_attachments
  for select
  using (
    (
      (current_user_role() = any (array['office'::app_role, 'admin'::app_role]))
      or exists (
        select 1 from public.projects p
        where p.id = project_attachments.project_id and p.next_owner_user_id = (select auth.uid())
      )
      or (
        current_user_role() = 'technician'::app_role
        and exists (
          select 1 from public.appointments a
          where a.project_id = project_attachments.project_id
            and (a.assigned_technician_id = (select auth.uid()) or a.assigned_technician_id_2 = (select auth.uid()))
        )
      )
    )
    and exists (
      select 1 from public.projects p
      join public.organization_memberships om on om.organization_id = p.organization_id
      where p.id = project_attachments.project_id and om.user_id = (select auth.uid()) and om.is_active
    )
  );

drop policy if exists attachments_insert on public.project_attachments;
create policy attachments_insert on public.project_attachments
  for insert
  with check (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role, 'technician'::app_role]))
    and exists (
      select 1 from public.projects p
      join public.organization_memberships om on om.organization_id = p.organization_id
      where p.id = project_attachments.project_id and om.user_id = (select auth.uid()) and om.is_active
    )
  );

drop policy if exists attachments_update on public.project_attachments;
create policy attachments_update on public.project_attachments
  for update
  using (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role, 'technician'::app_role]))
    and exists (
      select 1 from public.projects p
      join public.organization_memberships om on om.organization_id = p.organization_id
      where p.id = project_attachments.project_id and om.user_id = (select auth.uid()) and om.is_active
    )
  )
  with check (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role, 'technician'::app_role]))
    and exists (
      select 1 from public.projects p
      join public.organization_memberships om on om.organization_id = p.organization_id
      where p.id = project_attachments.project_id and om.user_id = (select auth.uid()) and om.is_active
    )
  );

drop policy if exists attachments_delete on public.project_attachments;
create policy attachments_delete on public.project_attachments
  for delete
  using (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role, 'technician'::app_role]))
    and exists (
      select 1 from public.projects p
      join public.organization_memberships om on om.organization_id = p.organization_id
      where p.id = project_attachments.project_id and om.user_id = (select auth.uid()) and om.is_active
    )
  );
