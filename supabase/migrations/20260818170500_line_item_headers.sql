-- Gruppierte Positionen: Abschnittsüberschriften (z. B. "Malerarbeiten") auf
-- Offerten/Rechnungen. Header-Zeilen laufen im selben Positions-Array mit,
-- haben aber keine Menge/Preis (App-seitig erzwungen: quantity=1, unit_price=0,
-- line_total=0 — damit die bestehenden Check-Constraints unverändert bleiben).

alter table public.quote_line_items
  add column if not exists item_type text not null default 'line'
    check (item_type in ('line', 'header'));

alter table public.invoice_line_items
  add column if not exists item_type text not null default 'line'
    check (item_type in ('line', 'header'));
