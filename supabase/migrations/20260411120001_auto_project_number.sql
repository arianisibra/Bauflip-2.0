create table if not exists public.project_number_counters (
  year integer primary key,
  next_number integer not null
);

create unique index if not exists idx_projects_reference_code_unique
  on public.projects (reference_code)
  where reference_code is not null;

create or replace function public.assign_project_reference_code()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  y integer;
  n integer;
begin
  if new.reference_code is not null and btrim(new.reference_code) <> '' then
    return new;
  end if;

  y := extract(year from coalesce(new.created_at, now()))::integer;

  insert into public.project_number_counters (year, next_number)
  values (y, 1001)
  on conflict (year)
  do update set next_number = public.project_number_counters.next_number + 1
  returning next_number - 1 into n;

  new.reference_code := y::text || '-' || n::text;
  return new;
end;
$$;

drop trigger if exists projects_assign_reference_code on public.projects;
create trigger projects_assign_reference_code
before insert on public.projects
for each row
execute function public.assign_project_reference_code();

with numbered as (
  select
    p.id,
    extract(year from p.created_at)::integer as y,
    999 + row_number() over (
      partition by extract(year from p.created_at)::integer
      order by p.created_at, p.id
    ) as seq
  from public.projects p
  where p.reference_code is null or btrim(p.reference_code) = ''
)
update public.projects p
set reference_code = numbered.y::text || '-' || numbered.seq::text
from numbered
where p.id = numbered.id;

insert into public.project_number_counters (year, next_number)
select
  split_part(reference_code, '-', 1)::integer as year,
  max(split_part(reference_code, '-', 2)::integer) + 1 as next_number
from public.projects
where reference_code ~ '^[0-9]{4}-[0-9]+$'
group by split_part(reference_code, '-', 1)::integer
on conflict (year)
do update
set next_number = excluded.next_number;
