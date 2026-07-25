-- "Nach Aufwand"-Positionen (Regie/Zeit & Material): Menge/Preis sind zum
-- Offert-/Rechnungszeitpunkt bewusst offen. Dritter item_type 'open' neben
-- 'line'/'header' — App-seitig wie 'header' auf quantity=1/unit_price=0/
-- line_total=0 gezwungen, zählt daher nicht in computeQuoteTotals().

alter table public.quote_line_items
  drop constraint if exists quote_line_items_item_type_check;
alter table public.quote_line_items
  add constraint quote_line_items_item_type_check
  check (item_type in ('line', 'header', 'open'));

alter table public.invoice_line_items
  drop constraint if exists invoice_line_items_item_type_check;
alter table public.invoice_line_items
  add constraint invoice_line_items_item_type_check
  check (item_type in ('line', 'header', 'open'));
