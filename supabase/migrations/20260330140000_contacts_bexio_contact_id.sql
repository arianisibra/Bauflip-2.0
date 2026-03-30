alter table public.contacts
  add column if not exists bexio_contact_id text;

comment on column public.contacts.bexio_contact_id is 'Optional: bexio Kontakt-/Company-ID für Zapier-Integration (manuell gepflegt).';
