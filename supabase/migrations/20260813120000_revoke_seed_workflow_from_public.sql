-- Die Seed-Funktionen waren über PostgREST unauthentifiziert aufrufbar
-- (SECURITY DEFINER + Standard-EXECUTE-Grant an PUBLIC). Der Schaden war durch
-- den Fremdschlüssel auf organizations und die Idempotenz begrenzt, aber ein
-- offener Schreib-Endpunkt bleibt ein offener Schreib-Endpunkt.
--
-- Einziger legitimer Aufrufer ist die Registrierung über den Service-Role-Client
-- (app/(auth)/registrieren/actions.ts) — der behält seine Rechte explizit.

revoke execute on function public.seed_default_workflow(uuid) from public, anon, authenticated;
grant execute on function public.seed_default_workflow(uuid) to service_role;

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'seed_storenbau_workflow'
  ) then
    execute 'revoke execute on function public.seed_storenbau_workflow(uuid) from public, anon, authenticated';
    execute 'grant execute on function public.seed_storenbau_workflow(uuid) to service_role';
  end if;
end $$;
