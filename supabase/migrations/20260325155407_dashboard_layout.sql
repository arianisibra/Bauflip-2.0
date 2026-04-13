alter table public.profiles
  add column if not exists dashboard_layout jsonb;

comment on column public.profiles.dashboard_layout is
  'User-specific Übersicht: ordered widget instances (version, items[{instanceId, widgetId}]).';
