-- Entfernt fälschlich als Arbeitsart erfasste Adresse (sollte kein Eintrag in project_work_types sein).
delete from public.project_work_types
where trim(name) = 'Lindenstrasse 12';
