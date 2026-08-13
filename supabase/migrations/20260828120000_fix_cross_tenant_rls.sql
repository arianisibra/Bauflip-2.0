-- Mandantentrennung: mandantenübergreifende Lese-, Schreib- und Löschzugriffe schliessen.
--
-- Befunde aus dem Sicherheitsaudit vom 13.08.2026 (K2, K3, K4, H1, H2).
-- Gemeinsame Ursache: `current_user_role()` liefert eine GLOBALE Rolle. Wird sie
-- ohne begleitenden Organisationsfilter geprüft, gilt "ist Admin" statt
-- "ist Admin DIESER Firma" — und jede Firma darf jede andere bearbeiten.
--
-- GRUNDSATZ ab hier: current_user_role() nie ohne Organisationsbedingung.
--
-- Alle Änderungen sind reine Verschärfungen. Legitime Zugriffe innerhalb der
-- eigenen Organisation bleiben unverändert möglich.

begin;

-- ---------------------------------------------------------------------------
-- K2  organizations: jeder Admin konnte jede fremde Firma lesen, ändern, löschen
-- ---------------------------------------------------------------------------
-- Nachgewiesen: ein Admin las alle 4 Mandanten samt intake_email_token und
-- billing_iban. Eine fremde IBAN liess sich überschreiben — künftige
-- QR-Rechnungen des fremden Betriebs wären auf ein anderes Konto gelaufen.

-- Lesen: nur noch über aktive Mitgliedschaft. Der pauschale Admin-Zweig entfällt.
alter policy "organizations_select" on public.organizations
  using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organizations.id
        and m.user_id = (select auth.uid())
        and m.is_active
    )
  );

alter policy "organizations_admin_update" on public.organizations
  using (
    current_user_role() = 'admin'::app_role
    and exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organizations.id
        and m.user_id = (select auth.uid())
        and m.is_active
    )
  )
  with check (
    current_user_role() = 'admin'::app_role
    and exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organizations.id
        and m.user_id = (select auth.uid())
        and m.is_active
    )
  );

alter policy "organizations_admin_delete" on public.organizations
  using (
    current_user_role() = 'admin'::app_role
    and exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organizations.id
        and m.user_id = (select auth.uid())
        and m.is_active
    )
  );

-- ---------------------------------------------------------------------------
-- K3  profiles: alle Personendaten aller Betriebe lesbar, änderbar, löschbar
-- ---------------------------------------------------------------------------
-- Ein DELETE kaskadiert (ON DELETE CASCADE) auf organization_memberships,
-- time_entries, technician_absences und die Kalendertabellen — ein fremder
-- Betrieb hätte erfasste Arbeitszeiten verloren, also Abrechnungsdaten.
--
-- Neue Regel: das eigene Profil immer, fremde nur bei gemeinsamer aktiver
-- Mitgliedschaft (Selbst-Join über organization_memberships).

alter policy "profiles_select_access" on public.profiles
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.organization_memberships eigene
      join public.organization_memberships fremde
        on fremde.organization_id = eigene.organization_id
      where eigene.user_id = (select auth.uid())
        and eigene.is_active
        and fremde.user_id = profiles.id
        and fremde.is_active
    )
  );

alter policy "profiles_self_or_admin_update" on public.profiles
  using (
    id = (select auth.uid())
    or (
      current_user_role() = 'admin'::app_role
      and exists (
        select 1
        from public.organization_memberships eigene
        join public.organization_memberships fremde
          on fremde.organization_id = eigene.organization_id
        where eigene.user_id = (select auth.uid())
          and eigene.is_active
          and fremde.user_id = profiles.id
          and fremde.is_active
      )
    )
  )
  with check (
    id = (select auth.uid())
    or (
      current_user_role() = 'admin'::app_role
      and exists (
        select 1
        from public.organization_memberships eigene
        join public.organization_memberships fremde
          on fremde.organization_id = eigene.organization_id
        where eigene.user_id = (select auth.uid())
          and eigene.is_active
          and fremde.user_id = profiles.id
          and fremde.is_active
      )
    )
  );

alter policy "profiles_admin_delete" on public.profiles
  using (
    current_user_role() = 'admin'::app_role
    and exists (
      select 1
      from public.organization_memberships eigene
      join public.organization_memberships fremde
        on fremde.organization_id = eigene.organization_id
      where eigene.user_id = (select auth.uid())
        and eigene.is_active
        and fremde.user_id = profiles.id
        and fremde.is_active
    )
  );

-- ---------------------------------------------------------------------------
-- H1  Rechteausweitung: profiles.role war selbst beschreibbar
-- ---------------------------------------------------------------------------
-- `authenticated` hatte UPDATE auf profiles.role. Ein Monteur konnte per
-- PATCH /rest/v1/profiles?id=eq.<eigene UUID> {"role":"admin"} seine eigene
-- Rolle hochsetzen — die Zeile gehört ihm, die Policy liess sie durch.
-- current_user_role() zieht profiles.role als dritte Stufe heran.
--
-- Die Rolle wird ausschliesslich serverseitig gesetzt (Service-Role bei
-- Registrierung und Einladungsannahme), nie durch den Nutzer selbst.
--
-- ACHTUNG, Postgres-Falle: Ein reines `revoke update (role)` bleibt WIRKUNGSLOS,
-- solange ein TABELLEN-Grant besteht — das Spaltenrecht wird daraus abgeleitet.
-- Deshalb erst den Tabellen-Grant entziehen, dann spaltenweise neu vergeben.
revoke update on public.profiles from authenticated, anon;
revoke insert on public.profiles from authenticated, anon;

-- Genau die Felder, die die App über den Nutzer-Client schreibt:
-- saveProfileSettingsAction (app/(app)/einstellungen/actions.ts:116) und
-- die Termin-Einladungs-Einstellung (invite-preference-actions.ts:29).
grant update (display_name, avatar_url, calendar_color, calendar_position,
              appointment_invites_enabled)
  on public.profiles to authenticated;

-- Der Sitzungs-Bootstrap (lib/auth/session.ts) legt fehlende Profile an.
-- `role` fällt dabei auf den Spalten-Default 'office' zurück und ist für den
-- Nutzer nicht mehr setzbar; massgeblich bleibt organization_memberships.
grant insert (id, display_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- K4  technician_report_order_forms: DELETE-Policy ohne Organisationsbezug
-- ---------------------------------------------------------------------------
-- Diese Policy steht in KEINER Migrationsdatei — sie existiert nur in der
-- Live-Datenbank (die zugehörige Migration 20260407120945 wurde auf `select 1;`
-- reduziert). Da permissive Policies mit ODER verknüpft werden, hob sie die
-- daneben liegende, korrekt org-geprüfte report_order_forms_delete vollständig
-- auf: ein Büro-Nutzer konnte die Formulare ALLER Mandanten löschen.
drop policy if exists "admin_delete_report_order_forms" on public.technician_report_order_forms;

-- ---------------------------------------------------------------------------
-- H2  technician_report_order_forms: SELECT liess Büro/Admin alle Mandanten lesen
-- ---------------------------------------------------------------------------
-- Der erste ODER-Zweig prüfte nur die Rolle. Die folgenden, korrekten Zweige
-- waren dadurch wirkungslos. Ergänzt um denselben Org-Join, den die
-- INSERT-Policy bereits verwendet. Die übrigen Zweige bleiben unverändert.
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
      select 1 from public.technician_reports tr
      where tr.id = technician_report_order_forms.technician_report_id
        and tr.created_by = (select auth.uid())
    )
    or (
      current_user_role() = 'technician'::app_role
      and exists (
        select 1
        from public.technician_reports tr
        join public.projects p on p.id = tr.project_id
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

commit;
