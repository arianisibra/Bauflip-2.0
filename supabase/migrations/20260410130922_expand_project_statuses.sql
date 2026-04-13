-- Expand project status check constraint from 4 to 15 workflow values
alter table public.projects
  drop constraint if exists projects_status_check;

alter table public.projects
  add constraint projects_status_check check (
    status in (
      'offen',
      'termin_geplant',
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
