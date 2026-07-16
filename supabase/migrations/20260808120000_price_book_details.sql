-- Preisstamm P1: zusätzliche Felder für aussagekräftigere Positionen.
-- Beschreibung (längerer Text), Kategorie (Gruppierung im Picker) und
-- Artikelnummer (interne/Lieferanten-Nummer). Alle optional/nullable → additiv,
-- keine Auswirkung auf bestehende Zeilen oder Code.

alter table public.price_book_items
  add column if not exists description text,
  add column if not exists category text,
  add column if not exists article_number text;

-- Kategorie-Gruppierung + Sortierung im Picker/Manager.
create index if not exists idx_price_book_items_org_category
  on public.price_book_items (organization_id, is_active, category, sort_order, name);
