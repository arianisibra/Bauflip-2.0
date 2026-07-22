-- Security-Review (Launch-Readiness): mitarbeiter_office_bootstrap ist SECURITY DEFINER
-- und war für die `anon`-Rolle ausführbar. Die Funktion selbst ist bereits sicher (sie
-- vergleicht p_org_id gegen current_organization_id() und liefert bei Mismatch/fehlender
-- Session nur leere Arrays), aber unauthentifizierte Aufrufbarkeit ist unnötige Angriffsfläche.
-- Defense-in-depth: EXECUTE für `anon` entziehen, `authenticated` bleibt (App-Zugriff via
-- Server Actions läuft ohnehin über die Service-Role, dieser RPC wird clientseitig genutzt).
revoke execute on function public.mitarbeiter_office_bootstrap(uuid) from anon;
