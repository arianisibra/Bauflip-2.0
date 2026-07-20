-- Automatische Kundennummern für Kontakte: K-001, K-002, … fortlaufend je
-- Organisation. Wird beim Anlegen vergeben, WENN das Feld leer bleibt — eine
-- manuell eingetippte Nummer wird nie überschrieben (überschreibbar).
--
-- Hinweis: Eine ältere Migration (20260325193647) nummerierte das inzwischen
-- abgebaute Kontakt-System (Spalten category/contact_number). Die heutige
-- contacts-Tabelle (20260809120000) nutzt kind/kunden_nummer und hat weder die
-- alte Zähler-Tabelle noch den alten Trigger — daher hier alles frisch, sauber
-- an die aktuellen Spalten gebunden.

-- Zähler je Organisation (interner Nummernkreis, nie über die API sichtbar).
create table if not exists public.contact_kunden_counters (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  last_value bigint not null default 0
);

comment on table public.contact_kunden_counters is
  'Interner Zähler für automatische Kundennummern (K-xxx) je Organisation.';

-- RLS-Deny wie bei quote_number_counters/project_number_counters: Tabelle bleibt
-- für anon/authenticated komplett gesperrt; nur die SECURITY-DEFINER-Triggerfunktion
-- (läuft als Table-Owner) schreibt hinein.
alter table public.contact_kunden_counters enable row level security;

drop policy if exists "contact_kunden_counters_no_rest" on public.contact_kunden_counters;
create policy "contact_kunden_counters_no_rest"
on public.contact_kunden_counters
for all
to anon, authenticated
using (false)
with check (false);

revoke all on public.contact_kunden_counters from public;
revoke all on public.contact_kunden_counters from anon;
revoke all on public.contact_kunden_counters from authenticated;

-- Vergabe-Funktion: leeres kunden_nummer → nächste Nummer der Org; sonst unverändert.
create or replace function public.contacts_assign_kunden_number ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
begin
  -- Manuell gesetzte Nummer respektieren (überschreibbar).
  if coalesce(trim(new.kunden_nummer), '') <> '' then
    return new;
  end if;

  -- contacts.organization_id ist NOT NULL — kein Null-Org-Sonderfall nötig.
  insert into public.contact_kunden_counters (organization_id, last_value)
  values (new.organization_id, 1)
  on conflict (organization_id) do update
    set last_value = public.contact_kunden_counters.last_value + 1
  returning last_value into v_next;

  new.kunden_nummer := 'K-' || lpad(v_next::text, 3, '0');
  return new;
end;
$$;

drop trigger if exists contacts_assign_kunden_number_before_insert on public.contacts;
create trigger contacts_assign_kunden_number_before_insert
before insert on public.contacts
for each row
execute function public.contacts_assign_kunden_number ();

-- Backfill: bestehende Kontakte ohne Nummer je Org fortlaufend nach Anlagedatum.
with numbered as (
  select
    id,
    organization_id,
    row_number() over (
      partition by organization_id
      order by created_at asc nulls last, id asc
    ) as seq
  from public.contacts
  where coalesce(trim(kunden_nummer), '') = ''
)
update public.contacts c
set kunden_nummer = 'K-' || lpad(n.seq::text, 3, '0')
from numbered n
where c.id = n.id;

-- Zähler je Org auf die höchste vergebene K-Nummer setzen (inkl. evtl. manueller).
insert into public.contact_kunden_counters (organization_id, last_value)
select
  organization_id,
  max((regexp_replace(kunden_nummer, '\D', '', 'g'))::bigint)
from public.contacts
where kunden_nummer ~ '^K-\d+$'
  and organization_id is not null
group by organization_id
on conflict (organization_id) do update
  set last_value = greatest(public.contact_kunden_counters.last_value, excluded.last_value);

-- Funktions-Grants: nur postgres/service_role dürfen sie ausführen (Trigger läuft
-- als Owner); nicht über PostgREST-RPC erreichbar.
revoke all on function public.contacts_assign_kunden_number () from public;
revoke all on function public.contacts_assign_kunden_number () from anon;
revoke all on function public.contacts_assign_kunden_number () from authenticated;
grant execute on function public.contacts_assign_kunden_number () to postgres;
grant execute on function public.contacts_assign_kunden_number () to service_role;
