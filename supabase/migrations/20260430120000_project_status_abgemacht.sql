-- Add workflow status: first agreed visit / appointment locked in ("abgemacht")
alter table public.projects
  drop constraint if exists projects_status_check;

alter table public.projects
  add constraint projects_status_check check (
    status in (
      'offen',
      'abgemacht',
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
