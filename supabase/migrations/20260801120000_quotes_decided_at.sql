-- Dashboard: Zeitpunkt der Offerten-Entscheidung (approved/rejected) — für
-- monatlichen Umsatz nach Entscheidungsdatum. `updated_at` ist ungeeignet
-- (Trigger touched sie bei jeder Änderung, nicht nur Statuswechsel).

alter table public.quotes
  add column if not exists decided_at timestamptz;

comment on column public.quotes.decided_at is
  'Zeitpunkt des Wechsels auf approved/rejected (App-seitig gesetzt in setQuoteStatus).';
