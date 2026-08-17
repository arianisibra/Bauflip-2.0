-- Zweiter Sicherheitsaudit (2026-08-30), Fund H1: Storage-Policies für den
-- Bucket 'document-templates' prüften nur das Organisationssegment im Pfad,
-- nicht die Rolle — anders als die begleitende Tabellen-Policy auf
-- document_templates (nur admin/office). Ein Techniker konnte damit die
-- .docx-Datei einer Vorlage direkt über Storage lesen, überschreiben oder
-- löschen, obwohl er die Tabellenzeile nicht ändern durfte. Eine überschriebene
-- Vorlage (z. B. geänderte IBAN im Offerten-Platzhalter) wirkt sich auf jedes
-- künftig erzeugte Dokument aus.

begin;

drop policy if exists "document_templates_select_org" on storage.objects;
drop policy if exists "document_templates_insert_org" on storage.objects;
drop policy if exists "document_templates_update_org" on storage.objects;
drop policy if exists "document_templates_delete_org" on storage.objects;

create policy "document_templates_select_org"
on storage.objects for select to authenticated
using (
  bucket_id = 'document-templates'
  and public.current_user_role() in ('admin', 'office')
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
);

create policy "document_templates_insert_org"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'document-templates'
  and public.current_user_role() in ('admin', 'office')
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
);

create policy "document_templates_update_org"
on storage.objects for update to authenticated
using (
  bucket_id = 'document-templates'
  and public.current_user_role() in ('admin', 'office')
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
)
with check (
  bucket_id = 'document-templates'
  and public.current_user_role() in ('admin', 'office')
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
);

create policy "document_templates_delete_org"
on storage.objects for delete to authenticated
using (
  bucket_id = 'document-templates'
  and public.current_user_role() in ('admin', 'office')
  and split_part(name, '/', 1) = (select public.current_organization_id())::text
);

commit;
