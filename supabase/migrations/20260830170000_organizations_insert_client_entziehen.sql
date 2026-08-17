-- Zweiter Sicherheitsaudit (2026-08-30), niedrig: organizations_admin_insert
-- prueft nur `current_user_role() = 'admin'`, nicht ob der Nutzer ueberhaupt
-- eine Mitgliedschaft haben DARF — jeder Admin (egal welcher Firma) konnte per
-- direktem PostgREST-INSERT beliebig neue, leere Organisationen anlegen.
-- Kein Anwendungscode nutzt diesen Pfad: die Registrierung
-- (registerOrganizationAction) laeuft ausschliesslich ueber die Service-Role.
-- Fix: die Policy ersatzlos entfernen — es gibt keinen legitimen
-- Nutzer-Client-Anwendungsfall dafuer.

begin;

drop policy if exists "organizations_admin_insert" on public.organizations;

commit;
