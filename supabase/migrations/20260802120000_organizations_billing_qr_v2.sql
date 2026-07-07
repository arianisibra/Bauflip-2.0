-- QR-Rechnung R1: Ergänzungen zu den bestehenden billing_*-Spalten (20260411120005).
-- Strukturierte Adressen (Typ S) sind seit Nov 2025 Pflicht → Hausnummer separat.
-- UID/MwSt-Nummer erscheint auf dem Rechnungsdokument, wenn gesetzt.

alter table public.organizations
  add column if not exists billing_creditor_building_number text,
  add column if not exists billing_vat_number text;

comment on column public.organizations.billing_creditor_building_number is
  'Gläubiger-Hausnummer für QR-Rechnungen (strukturierte Adresse, Typ S).';
comment on column public.organizations.billing_vat_number is
  'UID/MwSt-Nummer (z. B. CHE-123.456.789 MWST) — auf Rechnungen gedruckt, wenn gesetzt.';
