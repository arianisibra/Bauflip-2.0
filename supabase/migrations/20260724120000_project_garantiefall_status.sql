-- Garantiefall: neuer Status für Garantiefälle nach Projektabschluss + Dokumentationsfelder.

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
      'abgeschlossen',
      'garantiefall'
    )
  );

alter table public.projects
  add column if not exists warranty_note text;

alter table public.projects
  add column if not exists warranty_opened_at timestamptz;

alter table public.projects
  add column if not exists warranty_opened_by uuid references public.profiles(id) on delete set null;

alter table public.projects
  add column if not exists warranty_opened_by_display_name text;
