create or replace function public.current_user_role()
returns app_role
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role')::app_role,
    (select role from public.profiles where id = auth.uid())
  );
$$;
