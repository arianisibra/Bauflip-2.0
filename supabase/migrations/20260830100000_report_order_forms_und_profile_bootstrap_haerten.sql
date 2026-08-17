-- Nachbesserung zum zweiten Sicherheitsaudit (2026-08-30): drei Regressionen
-- aus der eigenen Korrektur vom 28.08. — der H2-Fix für
-- technician_report_order_forms wurde nur beim ersten ODER-Zweig zu Ende
-- geführt, und der profiles-Bootstrap-Grant deckt das UPSERT nicht vollständig ab.

begin;

-- ---------------------------------------------------------------------------
-- technician_report_order_forms: SELECT — auch die beiden verbliebenen Zweige
-- brauchen eine aktive Mitgliedschaft in der Organisation des Projekts. Ohne
-- diese Bedingung genügt allein `created_by = auth.uid()` bzw. die eigene
-- Zuweisung — beides bleibt zwar an den eigenen Nutzer gebunden, prüft aber
-- nicht, ob die Mitgliedschaft in der Zwischenzeit deaktiviert wurde
-- (z. B. nach einem Firmenwechsel oder einer Deaktivierung durch den Admin).
-- ---------------------------------------------------------------------------
alter policy "report_order_forms_select" on public.technician_report_order_forms
  using (
    (
      current_user_role() = any (array['office'::app_role, 'admin'::app_role])
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
    or exists (
      select 1
      from public.technician_reports tr
      join public.projects p on p.id = tr.project_id
      join public.organization_memberships om
        on om.organization_id = p.organization_id
       and om.user_id = (select auth.uid())
       and om.is_active
      where tr.id = technician_report_order_forms.technician_report_id
        and tr.created_by = (select auth.uid())
    )
    or (
      current_user_role() = 'technician'::app_role
      and exists (
        select 1
        from public.technician_reports tr
        join public.projects p on p.id = tr.project_id
        join public.organization_memberships om
          on om.organization_id = p.organization_id
         and om.user_id = (select auth.uid())
         and om.is_active
        where tr.id = technician_report_order_forms.technician_report_id
          and (
            p.next_owner_user_id = (select auth.uid())
            or exists (
              select 1 from public.appointments a
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

-- ---------------------------------------------------------------------------
-- technician_report_order_forms: INSERT/DELETE für Techniker — dieselbe
-- fehlende Mitgliedschaftsprüfung wie oben, symmetrisch nachgezogen.
-- ---------------------------------------------------------------------------
alter policy "report_order_forms_insert_technician_next_owner"
  on public.technician_report_order_forms
  with check (
    current_user_role() = 'technician'::app_role
    and exists (
      select 1
      from public.technician_reports tr
      join public.projects p on p.id = tr.project_id
      join public.organization_memberships om
        on om.organization_id = p.organization_id
       and om.user_id = (select auth.uid())
       and om.is_active
      where tr.id = technician_report_order_forms.technician_report_id
        and tr.created_by = (select auth.uid())
        and p.next_owner_user_id = (select auth.uid())
    )
  );

alter policy "report_order_forms_delete_technician_next_owner_own"
  on public.technician_report_order_forms
  using (
    current_user_role() = 'technician'::app_role
    and exists (
      select 1
      from public.technician_reports tr
      join public.projects p on p.id = tr.project_id
      join public.organization_memberships om
        on om.organization_id = p.organization_id
       and om.user_id = (select auth.uid())
       and om.is_active
      where tr.id = technician_report_order_forms.technician_report_id
        and tr.created_by = (select auth.uid())
        and p.next_owner_user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- profiles: der Session-Bootstrap (lib/auth/session.ts) legt fehlende Profile
-- per UPSERT mit onConflict "id" an. PostgREST übersetzt das in
-- `INSERT ... ON CONFLICT (id) DO UPDATE SET id = excluded.id,
--  display_name = excluded.display_name` — also braucht der Nutzer-Client
-- auch UPDATE auf der Spalte `id` selbst (Wert ändert sich dabei nie, da
-- id = excluded.id bei einem Konflikt auf id immer identisch ist).
-- Ohne dieses Recht schlägt der Bootstrap für neue Nutzer still fehl
-- (0 Zeilen betroffen, kein Fehler) und die Sitzung bleibt ohne Profil.
-- ---------------------------------------------------------------------------
grant update (id) on public.profiles to authenticated;

commit;
