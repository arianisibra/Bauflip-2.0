-- Performance: Indizes an die tatsächlichen Abfragemuster anpassen.
--
-- Aus dem Audit vom 13.08.2026, Kategorie «Index-Abdeckung». Alle Änderungen
-- sind idempotent und semantik-neutral — Abfrageergebnisse bleiben identisch.
--
-- EHRLICHE EINORDNUNG: Bei den heutigen Datenmengen (3 Offerten, wenige
-- Rechnungen, 5 Kontakte) misst man davon nichts. Postgres liest solche
-- Tabellen ohnehin am Stück. Der Nutzen entsteht bei Wachstum — und Indizes
-- legt man an, BEVOR die Daten da sind, nicht danach.

-- ---------------------------------------------------------------------------
-- quotes: Monatsumsatz im Dashboard
-- ---------------------------------------------------------------------------
-- Gelesen wird «angenommene Offerten dieser Organisation in einem Zeitfenster»
-- (lib/db/dashboard.ts). Der vorhandene Index (organization_id, created_at)
-- passt nicht: gefiltert wird auf `status` und sortiert nach `decided_at`.
-- Der partielle Index deckt Filter und Zeitfenster in einem ab und bleibt
-- klein, weil er nur angenommene Offerten enthält.
create index if not exists idx_quotes_org_decided_approved
  on public.quotes (organization_id, decided_at desc)
  where status = 'approved';

-- ---------------------------------------------------------------------------
-- invoices: offene Rechnungen (Dashboard + Zahlungsabgleich)
-- ---------------------------------------------------------------------------
-- Ohne diesen Index wird über (organization_id, created_at) gelesen und der
-- Status anschliessend Zeile für Zeile verworfen.
create index if not exists idx_invoices_org_status
  on public.invoices (organization_id, status);

-- ---------------------------------------------------------------------------
-- contacts: Verzeichnis ohne Aktiv-Filter
-- ---------------------------------------------------------------------------
-- idx_contacts_org_active_name hat `is_active` in der MITTE. Eine Abfrage, die
-- nur nach organization_id filtert und nach display_name sortiert, kann ihn
-- deshalb nicht zum Sortieren nutzen — Postgres sortiert nach. Der zusätzliche
-- Index deckt genau diesen Fall; der bestehende bleibt für die gefilterte
-- Ansicht erhalten.
create index if not exists idx_contacts_org_name
  on public.contacts (organization_id, display_name);

-- ---------------------------------------------------------------------------
-- project_orders: toter Index entfernen
-- ---------------------------------------------------------------------------
-- (organization_id) WHERE received_at IS NULL — dazu gibt es KEINE Abfrage im
-- Code (geprüft: kein Treffer auf project_orders mit organization_id oder
-- received_at ausserhalb der Projektbindung). Ein Index ohne Leser kostet bei
-- jedem Schreibvorgang Zeit und belegt Platz.
-- Falls später eine organisationsweite «offene Bestellungen»-Ansicht kommt,
-- wird er zusammen mit dieser Abfrage neu angelegt.
drop index if exists public.idx_project_orders_org_open;
