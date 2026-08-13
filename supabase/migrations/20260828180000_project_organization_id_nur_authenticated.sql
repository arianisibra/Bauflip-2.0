-- project_organization_id() war für `anon` aufrufbar.
--
-- Die Funktion ist SECURITY DEFINER und gibt zu einer Projekt-UUID die
-- Organisation zurück. Über PostgREST konnte sie ein Unangemeldeter mit dem
-- öffentlichen anon-Key direkt aufrufen — obwohl RLS ihm das Projekt selbst
-- nie zeigen würde. Damit liess sich zu einer irgendwo aufgeschnappten
-- Projekt-UUID (Link in einer Kunden-Mail, PDF-Metadaten, Support-Ticket)
-- ohne Login bestätigen, dass sie existiert, und der Mandant dahinter
-- zuordnen — ein Orakel für Zuordnung und Aufzählung.
--
-- WICHTIG, und abweichend von der Audit-Empfehlung: `authenticated` BEHÄLT das
-- Recht. Elf Policies auf appointments, technician_reports und
-- project_attachments rufen die Funktion in ihren USING-/WITH-CHECK-Ausdrücken
-- auf; diese werden als der abfragende Nutzer ausgewertet. Ein Entzug für
-- `authenticated` hätte Termine, Rapporte und Anhänge vollständig gesperrt.
--
-- Zu beachten: `revoke ... from public` nimmt auch `authenticated` das
-- implizite Recht (es erbt von PUBLIC) — deshalb muss es danach ausdrücklich
-- neu vergeben werden.
revoke execute on function public.project_organization_id(uuid) from public, anon;
grant execute on function public.project_organization_id(uuid) to authenticated;

-- Geprüft und bewusst NICHT angefasst: validate_project_status() gibt `trigger`
-- zurück. Solche Funktionen macht PostgREST gar nicht erst als RPC verfügbar,
-- der offene EXECUTE-Grant ist dort folgenlos.
