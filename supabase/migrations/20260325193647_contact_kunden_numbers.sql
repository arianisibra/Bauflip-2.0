-- Automatische Kundennummern: K-01, K-02, … pro Organisation (Kategorie «kunde»)

create table if not exists public.contact_kunden_counters (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  last_value bigint not null default 0
);

comment on table public.contact_kunden_counters is
  'Interner Zähler für automatische Kundennummern (K-xx) pro Organisation.';

create table if not exists public.contact_kunden_counter_null_org (
  id int primary key check (id = 1),
  last_value bigint not null default 0
);

insert into public.contact_kunden_counter_null_org (id, last_value)
values (1, 0)
on conflict (id) do nothing;

-- Bestehende Kunden neu durchnummerieren (älteste zuerst → K-01)
with numbered as (
  select
    id,
    row_number() over (
      partition by organization_id
      order by created_at asc nulls last, id asc
    ) as seq
  from public.contacts
  where category = 'kunde'
)
update public.contacts c
set contact_number = 'K-' || lpad(n.seq::text, 2, '0')
from numbered n
where c.id = n.id;

-- Zähler auf aktuelle Maximalwerte setzen
insert into public.contact_kunden_counters (organization_id, last_value)
select organization_id, count(*)::bigint
from public.contacts
where category = 'kunde'
  and organization_id is not null
group by organization_id
on conflict (organization_id) do update
set last_value = excluded.last_value;

update public.contact_kunden_counter_null_org
set last_value = coalesce(
  (
    select count(*)::bigint
    from public.contacts
    where category = 'kunde'
      and organization_id is null
  ),
  0
)
where id = 1;

create or replace function public.contacts_assign_kunden_number ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
begin
  if coalesce(trim(new.contact_number), '') <> '' then
    return new;
  end if;

  if new.category is distinct from 'kunde' then
    return new;
  end if;

  if new.organization_id is not null then
    insert into public.contact_kunden_counters (organization_id, last_value)
    values (new.organization_id, 1)
    on conflict (organization_id) do update
      set last_value = public.contact_kunden_counters.last_value + 1
    returning last_value into v_next;
  else
    update public.contact_kunden_counter_null_org
    set last_value = last_value + 1
    where id = 1
    returning last_value into v_next;
  end if;

  new.contact_number := 'K-' || lpad(v_next::text, 2, '0');
  return new;
end;
$$;

drop trigger if exists contacts_assign_kunden_number_before_insert on public.contacts;

create trigger contacts_assign_kunden_number_before_insert
before insert on public.contacts
for each row
execute function public.contacts_assign_kunden_number ();

revoke all on public.contact_kunden_counters from public;
revoke all on public.contact_kunden_counter_null_org from public;
