-- Mehrere Bestellzeilen pro Vorlage pro Rapport (z. B. zwei Rolläden).
alter table public.technician_report_order_forms
  drop constraint if exists technician_report_order_forms_technician_report_id_template_id_key;

comment on table public.technician_report_order_forms is
  'Ausgefüllte Bestellformulare je Rapport (mehrere Zeilen pro Vorlage möglich).';
