-- Monteur mit Termin-Zuweisung konnte project_attachments nicht lesen (nur next_owner).
-- Damit fehlten Galerie, getProjectCore-Attachments und serverseitige Lookups vor Löschen/Notiz.

drop policy if exists "attachments_read" on public.project_attachments;

create policy "attachments_read"
on public.project_attachments
for select
using (
  public.current_user_role() in ('office', 'admin')
  or exists (
    select 1
    from public.projects p
    where p.id = project_attachments.project_id
      and p.next_owner_user_id = (select auth.uid())
  )
  or (
    public.current_user_role() = 'technician'
    and exists (
      select 1
      from public.appointments a
      where a.project_id = project_attachments.project_id
        and a.assigned_technician_id = (select auth.uid())
    )
  )
);
