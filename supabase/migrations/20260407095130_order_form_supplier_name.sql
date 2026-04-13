-- Optionaler Lieferantenname pro Bestellformular-Vorlage (Anzeige / Gruppierung im CMS).
alter table public.order_form_templates
  add column if not exists supplier_name text;

comment on column public.order_form_templates.supplier_name is 'Freitext-Lieferant für dieses Formular (kein separater Lieferanten-Stamm).';
