-- Profil: öffentliche Avatar-URL (Storage public URL)
alter table public.profiles
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is
  'Public URL im Bucket avatars (Profilbild).';

-- Buckets: Profilbilder (öffentlich lesbar), Projektdateien (nur Org, signierte URLs)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-files',
  'project-files',
  false,
  15728640,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Avatars: nur eigener Ordner (erstes Pfadsegment = user id)
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;
drop policy if exists "project_files_select_org" on storage.objects;
drop policy if exists "project_files_insert_org" on storage.objects;
drop policy if exists "project_files_update_org" on storage.objects;
drop policy if exists "project_files_delete_org" on storage.objects;

create policy "avatars_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "avatars_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "avatars_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- Projektdateien: erstes Segment = Organisations-ID (wie current_organization_id)
create policy "project_files_select_org"
on storage.objects for select
to authenticated
using (
  bucket_id = 'project-files'
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
);

create policy "project_files_insert_org"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'project-files'
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
);

create policy "project_files_update_org"
on storage.objects for update
to authenticated
using (
  bucket_id = 'project-files'
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
)
with check (
  bucket_id = 'project-files'
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
);

create policy "project_files_delete_org"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'project-files'
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
);
