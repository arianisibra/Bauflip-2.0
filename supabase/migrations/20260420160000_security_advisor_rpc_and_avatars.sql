-- Supabase security advisor (WARN):
-- 0028/0029 assign_project_reference_code: trigger-only; must not be callable via PostgREST RPC.
-- 0028/0029 rls_auto_enable: not used by app; revoke client EXECUTE.
-- 0028 anon on current_organization_id / current_user_role: app calls RPC only when authenticated.
-- 0025 avatars_public_read: broad SELECT on public bucket enables listing; public URLs do not need it.

-- ---------------------------------------------------------------------------
-- RPC: assign_project_reference_code (BEFORE INSERT trigger only)
-- ---------------------------------------------------------------------------
revoke all on function public.assign_project_reference_code() from public;
revoke all on function public.assign_project_reference_code() from anon;
revoke all on function public.assign_project_reference_code() from authenticated;
grant execute on function public.assign_project_reference_code() to postgres;
grant execute on function public.assign_project_reference_code() to service_role;

-- ---------------------------------------------------------------------------
-- RPC: rls_auto_enable (maintenance helper; not used by Bauflip app)
-- ---------------------------------------------------------------------------
do $body$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
  ) then
    execute 'revoke all on function public.rls_auto_enable() from public';
    execute 'revoke all on function public.rls_auto_enable() from anon';
    execute 'revoke all on function public.rls_auto_enable() from authenticated';
    execute 'grant execute on function public.rls_auto_enable() to postgres';
    execute 'grant execute on function public.rls_auto_enable() to service_role';
  end if;
end $body$;

-- ---------------------------------------------------------------------------
-- RPC: org helpers — keep authenticated (used by server client + RLS patterns).
-- anon inherited EXECUTE via PUBLIC; revoke PUBLIC then re-grant explicitly.
-- ---------------------------------------------------------------------------
revoke execute on function public.current_organization_id() from public;
revoke execute on function public.current_user_role() from public;
revoke all on function public.current_organization_id() from anon;
revoke all on function public.current_user_role() from anon;
grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_organization_id() to service_role;
grant execute on function public.current_user_role() to service_role;
grant execute on function public.current_organization_id() to postgres;
grant execute on function public.current_user_role() to postgres;

-- ---------------------------------------------------------------------------
-- Storage: public avatars bucket — drop listing policy (lint 0025)
-- ---------------------------------------------------------------------------
drop policy if exists "avatars_public_read" on storage.objects;
