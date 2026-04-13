alter table public.organizations
  add column if not exists zapier_enabled boolean not null default false,
  add column if not exists zapier_webhook_url text,
  add column if not exists zapier_signing_secret text,
  add column if not exists zapier_last_test_at timestamptz,
  add column if not exists zapier_last_error text;

