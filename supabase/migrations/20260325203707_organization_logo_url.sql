alter table public.organizations
  add column if not exists logo_url text;

comment on column public.organizations.logo_url is 'Öffentliche URL zum Firmenlogo (z. B. Supabase Storage).';
