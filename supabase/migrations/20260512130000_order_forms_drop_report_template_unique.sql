-- Mehrere Bestellzeilen pro Vorlage pro Rapport (z. B. «Weitere Position»): der alte Unique
-- auf (technician_report_id, template_id) muss weg. Migration 20260410130957 droppte nur
-- den Namen `…_template_id_key`; auf manchen DBs heisst der Constraint `…_template_key`
-- (oder wurde nie entfernt) → duplicate key beim Abschliessen des Rapports.
alter table public.technician_report_order_forms
  drop constraint if exists technician_report_order_forms_technician_report_id_template_id_key;

alter table public.technician_report_order_forms
  drop constraint if exists technician_report_order_forms_technician_report_id_template_key;

-- Falls der Name abweicht: jede UNIQUE-Constraint, die beide Spalten zusammen eindeutig macht.
do $$
declare
  r record;
begin
  for r in
    select c.conname::text as conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'technician_report_order_forms'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) like '%technician_report_id%'
      and pg_get_constraintdef(c.oid) like '%template_id%'
  loop
    execute format(
      'alter table public.technician_report_order_forms drop constraint if exists %I',
      r.conname
    );
  end loop;
end $$;

comment on table public.technician_report_order_forms is
  'Ausgefüllte Bestellformulare je Rapport (mehrere Zeilen pro Vorlage möglich).';
