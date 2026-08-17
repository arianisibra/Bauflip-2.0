-- Zweiter Sicherheitsaudit (2026-08-30), niedrig: eine manuell eingetragene
-- Kundennummer kann den Zaehler ueberholen und spaeter mit der automatisch
-- vergebenen Nummer kollidieren — nichts fing das bisher ab. Ein
-- partieller Unique-Index deckt die Luecke ab, ohne bestehende leere
-- kunden_nummer-Werte zu beruehren (die duerfen weiterhin mehrfach leer sein).

begin;

create unique index if not exists contacts_org_kunden_nummer_eindeutig
  on public.contacts (organization_id, kunden_nummer)
  where kunden_nummer is not null and trim(kunden_nummer) <> '';

commit;
