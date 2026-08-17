-- Zweiter Sicherheitsaudit (2026-08-30), Fund H4: die Storage-Policy fuer den
-- Bucket 'project-files' pruefte nur das Organisationssegment im Pfad
-- ({organizationId}/{projectId}/...), nicht das Projektsegment — anders als
-- die begleitende Tabellen-Policy `attachments_read` auf project_attachments,
-- die Technikern nur Anhaenge der Projekte zeigt, denen sie zugewiesen sind
-- (next_owner_user_id bzw. appointments.assigned_technician_id/_2). Ein
-- Techniker konnte damit ueber den direkten Storage-Pfad (organizationId
-- bekannt, projectId aus einer beliebigen Quelle) Dateien FREMDER Projekte
-- derselben Organisation lesen, obwohl die Tabellenzeile ihm das verweigert
-- haette.
--
-- Fund M (Batch 2): dieselbe fehlende Projektbindung betraf auch
-- Ueberschreiben/Loeschen — hier gleich mit nachgezogen, damit Schreib- und
-- Lesepfad denselben Massstab haben.

begin;

drop policy if exists "project_files_select_org" on storage.objects;
drop policy if exists "project_files_insert_org" on storage.objects;
drop policy if exists "project_files_update_org" on storage.objects;
drop policy if exists "project_files_delete_org" on storage.objects;

create policy "project_files_select_org"
on storage.objects for select
to authenticated
using (
  bucket_id = 'project-files'
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
  and (
    current_user_role() = any (array['office'::app_role, 'admin'::app_role])
    or exists (
      select 1 from public.projects p
      where p.id::text = split_part(name, '/', 2)
        and p.next_owner_user_id = (select auth.uid())
    )
    or (
      current_user_role() = 'technician'::app_role
      and exists (
        select 1 from public.appointments a
        where a.project_id::text = split_part(name, '/', 2)
          and (
            a.assigned_technician_id = (select auth.uid())
            or a.assigned_technician_id_2 = (select auth.uid())
          )
      )
    )
  )
);

-- Schreibpfade: Rolle + Org wie bisher, zusaetzlich dasselbe Projektsegment
-- wie beim Lesen (Techniker duerfen nur bei eigener Zuweisung schreiben/loeschen).
create policy "project_files_insert_org"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'project-files'
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
  and current_user_role() = any (array['office'::app_role, 'admin'::app_role, 'technician'::app_role])
  and (
    current_user_role() = any (array['office'::app_role, 'admin'::app_role])
    or exists (
      select 1 from public.projects p
      where p.id::text = split_part(name, '/', 2)
        and p.next_owner_user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.appointments a
      where a.project_id::text = split_part(name, '/', 2)
        and (
          a.assigned_technician_id = (select auth.uid())
          or a.assigned_technician_id_2 = (select auth.uid())
        )
    )
  )
);

create policy "project_files_update_org"
on storage.objects for update
to authenticated
using (
  bucket_id = 'project-files'
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
  and current_user_role() = any (array['office'::app_role, 'admin'::app_role, 'technician'::app_role])
  and (
    current_user_role() = any (array['office'::app_role, 'admin'::app_role])
    or exists (
      select 1 from public.projects p
      where p.id::text = split_part(name, '/', 2)
        and p.next_owner_user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.appointments a
      where a.project_id::text = split_part(name, '/', 2)
        and (
          a.assigned_technician_id = (select auth.uid())
          or a.assigned_technician_id_2 = (select auth.uid())
        )
    )
  )
)
with check (
  bucket_id = 'project-files'
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
  and current_user_role() = any (array['office'::app_role, 'admin'::app_role, 'technician'::app_role])
);

create policy "project_files_delete_org"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'project-files'
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
  and current_user_role() = any (array['office'::app_role, 'admin'::app_role, 'technician'::app_role])
  and (
    current_user_role() = any (array['office'::app_role, 'admin'::app_role])
    or exists (
      select 1 from public.projects p
      where p.id::text = split_part(name, '/', 2)
        and p.next_owner_user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.appointments a
      where a.project_id::text = split_part(name, '/', 2)
        and (
          a.assigned_technician_id = (select auth.uid())
          or a.assigned_technician_id_2 = (select auth.uid())
        )
    )
  )
);

commit;
