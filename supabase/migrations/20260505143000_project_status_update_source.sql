alter table public.projects
  add column if not exists status_updated_source text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_status_updated_source_check'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_status_updated_source_check
      check (
        status_updated_source is null
        or status_updated_source in ('manual', 'appointment_automation')
      );
  end if;
end $$;
