-- Zweiter Sicherheitsaudit (2026-08-30), niedrig: die Haertung von
-- project_number_counters (Migration 20260420140000) rief `revoke ... from
-- public`, nicht `revoke ... from anon, authenticated` wie bei den drei
-- Schwestertabellen (quotes/invoices/contacts-Nummernkreise). Ein Grant an
-- PUBLIC steht aber neben einem direkten Grant an eine Rolle weiter in Kraft
-- — anon/authenticated hatten dadurch weiterhin volles CRUD auf der Zaehler-
-- tabelle, obwohl nur der SECURITY-DEFINER-Trigger (Rolle postgres) sie
-- braucht. Ursache ist eine Supabase-Voreinstellung: ALTER DEFAULT
-- PRIVILEGES fuer Rolle postgres in Schema public vergibt jeder neuen Tabelle
-- automatisch volle Rechte an anon UND authenticated.

begin;

revoke all on public.project_number_counters from anon, authenticated;

commit;
