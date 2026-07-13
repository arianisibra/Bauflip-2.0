-- Dokument-Vorlagen (Word/.docx) je Organisation: hochgeladene Vorlagen, die Bauflip
-- über Platzhalter füllt (docxtemplater). Siehe docs/PLAN-dokument-vorlagen.md.
-- Die .docx-Datei liegt im privaten Bucket 'document-templates' unter {org}/{id}.docx.

create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('offerte', 'auftrag', 'rapport', 'rechnung')),
  name text not null,
  storage_path text not null,
  output_format text not null default 'docx' check (output_format in ('docx', 'pdf')),
  is_default boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.document_templates is
  'Word-Vorlagen (.docx) je Organisation für Offerten/Aufträge/Rapporte/Rechnungen — von Bauflip mit Platzhaltern gefüllt.';

-- Höchstens eine Standard-Vorlage je (Organisation, Dokumenttyp).
create unique index if not exists document_templates_one_default
  on public.document_templates (organization_id, kind) where is_default;

create index if not exists idx_document_templates_org_kind
  on public.document_templates (organization_id, kind);

alter table public.document_templates enable row level security;

drop policy if exists "document_templates_all_office_admin_org" on public.document_templates;
create policy "document_templates_all_office_admin_org"
on public.document_templates
for all
using (
  public.current_user_role() in ('admin', 'office')
  and organization_id in (
    select om.organization_id from public.organization_memberships om
    where om.user_id = (select auth.uid()) and om.is_active
  )
)
with check (
  public.current_user_role() in ('admin', 'office')
  and organization_id in (
    select om.organization_id from public.organization_memberships om
    where om.user_id = (select auth.uid()) and om.is_active
  )
);

-- Privater Bucket für die Vorlagen-Dateien (.docx).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'document-templates',
  'document-templates',
  false,
  10485760,
  array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Pfad-Konvention: {organizationId}/{templateId}.docx — Org-Scoping über das erste Pfadsegment.
drop policy if exists "document_templates_select_org" on storage.objects;
drop policy if exists "document_templates_insert_org" on storage.objects;
drop policy if exists "document_templates_update_org" on storage.objects;
drop policy if exists "document_templates_delete_org" on storage.objects;

create policy "document_templates_select_org"
on storage.objects for select to authenticated
using (
  bucket_id = 'document-templates'
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
);

create policy "document_templates_insert_org"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'document-templates'
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
);

create policy "document_templates_update_org"
on storage.objects for update to authenticated
using (
  bucket_id = 'document-templates'
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
)
with check (
  bucket_id = 'document-templates'
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
);

create policy "document_templates_delete_org"
on storage.objects for delete to authenticated
using (
  bucket_id = 'document-templates'
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
);
