-- Vereinfachung: Status «termin_geplant» entfällt — alle bestehenden Zeilen werden «abgemacht»
-- (war fachlich mit «abgemacht» praktisch identisch; Auto-Upgrade-Logik im App-Code entfällt).

update public.projects
set status = 'abgemacht'
where status = 'termin_geplant';

alter table public.projects
  drop constraint if exists projects_status_check;

alter table public.projects
  add constraint projects_status_check check (
    status in (
      'offen',
      'abgemacht',
      'einsatz_offen',
      'offerte_senden',
      'offerte_gesendet',
      'offerte_genehmigt',
      'bestellen',
      'bestellt',
      'montagebereit',
      'abholbereit',
      'werkstatt',
      'abklaeren',
      'abrechnen',
      'subunternehmer',
      'abgeschlossen'
    )
  );
