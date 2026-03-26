-- Privater Bucket für finale PDF-Dokumente pro Projekt
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-documents',
  'project-documents',
  false,
  15728640,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "project_documents_select_org" on storage.objects;
drop policy if exists "project_documents_insert_org" on storage.objects;
drop policy if exists "project_documents_update_org" on storage.objects;
drop policy if exists "project_documents_delete_org" on storage.objects;

create policy "project_documents_select_org"
on storage.objects for select
to authenticated
using (
  bucket_id = 'project-documents'
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
);

create policy "project_documents_insert_org"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'project-documents'
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
);

create policy "project_documents_update_org"
on storage.objects for update
to authenticated
using (
  bucket_id = 'project-documents'
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
)
with check (
  bucket_id = 'project-documents'
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
);

create policy "project_documents_delete_org"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'project-documents'
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
);
