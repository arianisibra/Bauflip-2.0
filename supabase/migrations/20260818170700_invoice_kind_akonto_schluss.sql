-- Schlussrechnungs-Workflow: Rechnungsart (Standard/Akontorechnung/Schlussrechnung).
-- Bei Schlussrechnungen wird die Summe bereits gestellter Akontorechnungen desselben
-- Projekts (Status "sent"/"paid") beim Speichern eingefroren (deducted_amount) und im
-- PDF sowie im QR-Zahlbetrag vom Total abgezogen — der offizielle Rechnungsbetrag
-- (total_gross) bleibt dabei unverändert die volle Auftragssumme.

alter table public.invoices
  add column if not exists invoice_kind text not null default 'standard'
    check (invoice_kind in ('standard', 'deposit', 'final')),
  add column if not exists deducted_amount numeric(12, 2) not null default 0;
