-- Korrigiert eine zirkuläre RLS-Referenz, die die vorherige Migration
-- (20260818170000) eingeführt hat: projects-Policy prüft appointments,
-- appointments-Policy prüfte neu projects zurück → "infinite recursion
-- detected in policy for relation projects".
--
-- Fix: appointments/technician_reports/project_attachments ermitteln die
-- Organisation eines Projekts jetzt über eine SECURITY DEFINER-Hilfsfunktion
-- (liest projects.organization_id OHNE projects' RLS zu durchlaufen) statt
-- über einen normalen Join auf projects. Das durchbricht den Zyklus, die
-- Zugriffslogik selbst bleibt unverändert (nur derselbe Membership-Check).

create or replace function public.project_organization_id(p_project_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.projects where id = p_project_id;
$$;

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
    and public.project_organization_id(project_id) in (
      select om.organization_id from public.organization_memberships om
      where om.user_id = (select auth.uid()) and om.is_active
    )
  );

drop policy if exists appointments_insert_office_admin on public.appointments;
create policy appointments_insert_office_admin on public.appointments
  for insert
  with check (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role]))
    and public.project_organization_id(project_id) in (
      select om.organization_id from public.organization_memberships om
      where om.user_id = (select auth.uid()) and om.is_active
    )
  );

drop policy if exists appointments_update_office_admin on public.appointments;
create policy appointments_update_office_admin on public.appointments
  for update
  using (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role]))
    and public.project_organization_id(project_id) in (
      select om.organization_id from public.organization_memberships om
      where om.user_id = (select auth.uid()) and om.is_active
    )
  )
  with check (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role]))
    and public.project_organization_id(project_id) in (
      select om.organization_id from public.organization_memberships om
      where om.user_id = (select auth.uid()) and om.is_active
    )
  );

drop policy if exists appointments_delete_office_admin on public.appointments;
create policy appointments_delete_office_admin on public.appointments
  for delete
  using (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role]))
    and public.project_organization_id(project_id) in (
      select om.organization_id from public.organization_memberships om
      where om.user_id = (select auth.uid()) and om.is_active
    )
  );

-- ── technician_reports ──────────────────────────────────────────────────────
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
    and public.project_organization_id(project_id) in (
      select om.organization_id from public.organization_memberships om
      where om.user_id = (select auth.uid()) and om.is_active
    )
  );

drop policy if exists technician_reports_write on public.technician_reports;
create policy technician_reports_write on public.technician_reports
  for insert
  with check (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role, 'technician'::app_role]))
    and public.project_organization_id(project_id) in (
      select om.organization_id from public.organization_memberships om
      where om.user_id = (select auth.uid()) and om.is_active
    )
  );

drop policy if exists admin_delete_technician_reports on public.technician_reports;
create policy admin_delete_technician_reports on public.technician_reports
  for delete
  using (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role]))
    and public.project_organization_id(project_id) in (
      select om.organization_id from public.organization_memberships om
      where om.user_id = (select auth.uid()) and om.is_active
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
    and public.project_organization_id(project_id) in (
      select om.organization_id from public.organization_memberships om
      where om.user_id = (select auth.uid()) and om.is_active
    )
  );

drop policy if exists attachments_insert on public.project_attachments;
create policy attachments_insert on public.project_attachments
  for insert
  with check (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role, 'technician'::app_role]))
    and public.project_organization_id(project_id) in (
      select om.organization_id from public.organization_memberships om
      where om.user_id = (select auth.uid()) and om.is_active
    )
  );

drop policy if exists attachments_update on public.project_attachments;
create policy attachments_update on public.project_attachments
  for update
  using (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role, 'technician'::app_role]))
    and public.project_organization_id(project_id) in (
      select om.organization_id from public.organization_memberships om
      where om.user_id = (select auth.uid()) and om.is_active
    )
  )
  with check (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role, 'technician'::app_role]))
    and public.project_organization_id(project_id) in (
      select om.organization_id from public.organization_memberships om
      where om.user_id = (select auth.uid()) and om.is_active
    )
  );

drop policy if exists attachments_delete on public.project_attachments;
create policy attachments_delete on public.project_attachments
  for delete
  using (
    (current_user_role() = any (array['office'::app_role, 'admin'::app_role, 'technician'::app_role]))
    and public.project_organization_id(project_id) in (
      select om.organization_id from public.organization_memberships om
      where om.user_id = (select auth.uid()) and om.is_active
    )
  );
