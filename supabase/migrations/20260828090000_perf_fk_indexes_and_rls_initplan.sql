-- Performance-Runde (Supabase-Advisor).
--
-- Zwei sichere, semantik-erhaltende Optimierungen:
--   1. Deckende Indizes für Fremdschlüssel ohne Index (unindexed_foreign_keys).
--      Beschleunigt Joins über diese Spalten und verhindert Full-Table-Scans,
--      wenn eine referenzierte Zeile gelöscht/aktualisiert wird.
--   2. auth.uid() in RLS-Policies in ein Sub-Select kappen (auth_rls_initplan),
--      damit es einmal pro Anweisung statt einmal pro Zeile ausgewertet wird.
--      Rein performanter Umbau — die Zugriffslogik bleibt identisch.
--
-- Bewusst NICHT enthalten (siehe Analyse):
--   - multiple_permissive_policies: Zusammenlegen ändert Sicherheitslogik,
--     Nutzen bei aktueller Datenmenge gering, Risiko auf Live-DB zu hoch.
--   - unused_index: „ungenutzt" heisst bei junger DB oft „noch nicht genutzt";
--     Schreib-/Speicherersparnis bei wenigen hundert Zeilen vernachlässigbar.

-- 1) Deckende FK-Indizes -----------------------------------------------------

create index if not exists idx_appointment_calendar_events_technician_id
  on public.appointment_calendar_events (technician_id);

create index if not exists idx_contacts_created_by
  on public.contacts (created_by);

create index if not exists idx_document_templates_created_by
  on public.document_templates (created_by);

create index if not exists idx_organization_secrets_updated_by
  on public.organization_secrets (updated_by);

create index if not exists idx_payment_imports_imported_by
  on public.payment_imports (imported_by);

create index if not exists idx_project_contacts_organization_id
  on public.project_contacts (organization_id);

create index if not exists idx_project_orders_created_by
  on public.project_orders (created_by);

create index if not exists idx_projects_archived_by
  on public.projects (archived_by);

create index if not exists idx_projects_warranty_opened_by
  on public.projects (warranty_opened_by);

create index if not exists idx_quotes_approved_by
  on public.quotes (approved_by);

create index if not exists idx_workflow_transitions_organization_id
  on public.workflow_transitions (organization_id);

-- 2) RLS initplan: auth.uid() -> (select auth.uid()) -------------------------
-- Nur die zwei noch nicht gekappten Tabellen. Die übrigen Policies verwenden
-- bereits (select auth.uid()).

-- technician_calendar_connections: eigene Verbindung
alter policy "own calendar connection" on public.technician_calendar_connections
  using (technician_id = (select auth.uid()))
  with check (technician_id = (select auth.uid()));

-- project_orders: SELECT (org-Mitgliedschaft)
alter policy "project_orders_select_org" on public.project_orders
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = project_orders.organization_id
      and m.user_id = (select auth.uid())
      and m.is_active));

-- project_orders: INSERT (office/admin der Org)
alter policy "project_orders_insert_office_admin" on public.project_orders
  with check (
    current_user_role() = any (array['admin'::app_role, 'office'::app_role])
    and exists (
      select 1 from public.organization_memberships m
      where m.organization_id = project_orders.organization_id
        and m.user_id = (select auth.uid())
        and m.is_active));

-- project_orders: UPDATE (office/admin der Org)
alter policy "project_orders_update_office_admin" on public.project_orders
  using (
    current_user_role() = any (array['admin'::app_role, 'office'::app_role])
    and exists (
      select 1 from public.organization_memberships m
      where m.organization_id = project_orders.organization_id
        and m.user_id = (select auth.uid())
        and m.is_active));

-- project_orders: DELETE (office/admin der Org)
alter policy "project_orders_delete_office_admin" on public.project_orders
  using (
    current_user_role() = any (array['admin'::app_role, 'office'::app_role])
    and exists (
      select 1 from public.organization_memberships m
      where m.organization_id = project_orders.organization_id
        and m.user_id = (select auth.uid())
        and m.is_active));
