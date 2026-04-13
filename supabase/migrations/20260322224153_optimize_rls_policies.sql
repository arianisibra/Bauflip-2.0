-- Performance optimization:
-- 1) wrap auth.uid() calls with (select auth.uid())
-- 2) avoid overlapping SELECT via FOR ALL policies

-- profiles
drop policy if exists "profiles_own_read" on public.profiles;
drop policy if exists "profiles_admin_manage" on public.profiles;

create policy "profiles_select_access"
on public.profiles
for select
using (
  id = (select auth.uid())
  or public.current_user_role() = 'admin'
);

create policy "profiles_admin_insert"
on public.profiles
for insert
with check (public.current_user_role() = 'admin');

create policy "profiles_admin_update"
on public.profiles
for update
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "profiles_admin_delete"
on public.profiles
for delete
using (public.current_user_role() = 'admin');

-- customers
drop policy if exists "office_admin_read_customers" on public.customers;
drop policy if exists "office_admin_write_customers" on public.customers;

create policy "office_admin_read_customers"
on public.customers
for select
using (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_insert_customers"
on public.customers
for insert
with check (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_update_customers"
on public.customers
for update
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_delete_customers"
on public.customers
for delete
using (public.current_user_role() in ('office', 'admin'));

-- projects
drop policy if exists "office_admin_read_projects" on public.projects;
drop policy if exists "office_admin_write_projects" on public.projects;
drop policy if exists "technician_assigned_projects" on public.projects;

create policy "office_admin_read_projects"
on public.projects
for select
using (public.current_user_role() in ('office', 'admin'));

create policy "technician_assigned_projects"
on public.projects
for select
using (
  public.current_user_role() = 'technician'
  and (
    next_owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.appointments a
      where a.project_id = projects.id
        and a.assigned_technician_id = (select auth.uid())
    )
  )
);

create policy "office_admin_insert_projects"
on public.projects
for insert
with check (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_update_projects"
on public.projects
for update
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "office_admin_delete_projects"
on public.projects
for delete
using (public.current_user_role() in ('office', 'admin'));

-- customer_contacts
drop policy if exists "allow_role_based_read_all_domain" on public.customer_contacts;
drop policy if exists "allow_role_based_write_all_domain" on public.customer_contacts;

create policy "allow_role_based_read_all_domain"
on public.customer_contacts
for select
using (public.current_user_role() in ('office', 'admin'));

create policy "allow_role_based_insert_all_domain"
on public.customer_contacts
for insert
with check (public.current_user_role() in ('office', 'admin'));

create policy "allow_role_based_update_all_domain"
on public.customer_contacts
for update
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "allow_role_based_delete_all_domain"
on public.customer_contacts
for delete
using (public.current_user_role() in ('office', 'admin'));

-- project_notes
drop policy if exists "project_children_read" on public.project_notes;
drop policy if exists "project_children_write_office_admin" on public.project_notes;

create policy "project_children_read"
on public.project_notes
for select
using (
  public.current_user_role() in ('office', 'admin')
  or exists (
    select 1 from public.projects p
    where p.id = project_notes.project_id
      and (
        p.next_owner_user_id = (select auth.uid())
        or public.current_user_role() = 'technician'
      )
  )
);

create policy "project_children_insert_office_admin"
on public.project_notes
for insert
with check (public.current_user_role() in ('office', 'admin', 'technician'));

create policy "project_children_update_office_admin"
on public.project_notes
for update
using (public.current_user_role() in ('office', 'admin', 'technician'))
with check (public.current_user_role() in ('office', 'admin', 'technician'));

create policy "project_children_delete_office_admin"
on public.project_notes
for delete
using (public.current_user_role() in ('office', 'admin', 'technician'));

-- project_attachments
drop policy if exists "attachments_read" on public.project_attachments;
drop policy if exists "attachments_write" on public.project_attachments;

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
);

create policy "attachments_insert"
on public.project_attachments
for insert
with check (public.current_user_role() in ('office', 'admin', 'technician'));

create policy "attachments_update"
on public.project_attachments
for update
using (public.current_user_role() in ('office', 'admin', 'technician'))
with check (public.current_user_role() in ('office', 'admin', 'technician'));

create policy "attachments_delete"
on public.project_attachments
for delete
using (public.current_user_role() in ('office', 'admin', 'technician'));

-- appointments
drop policy if exists "appointments_read_by_role" on public.appointments;
drop policy if exists "appointments_write_office_admin" on public.appointments;

create policy "appointments_read_by_role"
on public.appointments
for select
using (
  public.current_user_role() in ('office', 'admin')
  or assigned_technician_id = (select auth.uid())
);

create policy "appointments_insert_office_admin"
on public.appointments
for insert
with check (public.current_user_role() in ('office', 'admin'));

create policy "appointments_update_office_admin"
on public.appointments
for update
using (public.current_user_role() in ('office', 'admin'))
with check (public.current_user_role() in ('office', 'admin'));

create policy "appointments_delete_office_admin"
on public.appointments
for delete
using (public.current_user_role() in ('office', 'admin'));

-- technician_reports (uid performance only)
drop policy if exists "technician_reports_read" on public.technician_reports;
create policy "technician_reports_read"
on public.technician_reports
for select
using (
  public.current_user_role() in ('office', 'admin')
  or created_by = (select auth.uid())
);

-- kanban_columns
drop policy if exists "kanban_read_role_based" on public.kanban_columns;
drop policy if exists "kanban_write_admin_office" on public.kanban_columns;

create policy "kanban_read_role_based"
on public.kanban_columns
for select
using (
  public.current_user_role() in ('admin', 'office')
  or exists (
    select 1 from public.projects p
    where p.id = kanban_columns.project_id
      and p.next_owner_user_id = (select auth.uid())
  )
);

create policy "kanban_insert_admin_office"
on public.kanban_columns
for insert
with check (public.current_user_role() in ('admin', 'office'));

create policy "kanban_update_admin_office"
on public.kanban_columns
for update
using (public.current_user_role() in ('admin', 'office'))
with check (public.current_user_role() in ('admin', 'office'));

create policy "kanban_delete_admin_office"
on public.kanban_columns
for delete
using (public.current_user_role() in ('admin', 'office'));

-- kanban_cards
drop policy if exists "kanban_cards_read_role_based" on public.kanban_cards;
drop policy if exists "kanban_cards_write_admin_office" on public.kanban_cards;

create policy "kanban_cards_read_role_based"
on public.kanban_cards
for select
using (
  public.current_user_role() in ('admin', 'office')
  or exists (
    select 1 from public.projects p
    where p.id = kanban_cards.project_id
      and p.next_owner_user_id = (select auth.uid())
  )
);

create policy "kanban_cards_insert_admin_office"
on public.kanban_cards
for insert
with check (public.current_user_role() in ('admin', 'office'));

create policy "kanban_cards_update_admin_office"
on public.kanban_cards
for update
using (public.current_user_role() in ('admin', 'office'))
with check (public.current_user_role() in ('admin', 'office'));

create policy "kanban_cards_delete_admin_office"
on public.kanban_cards
for delete
using (public.current_user_role() in ('admin', 'office'));

-- project_chat_messages
drop policy if exists "chat_read_role_based" on public.project_chat_messages;
drop policy if exists "chat_write_all_roles" on public.project_chat_messages;

create policy "chat_read_role_based"
on public.project_chat_messages
for select
using (
  public.current_user_role() in ('admin', 'office')
  or sender_id = (select auth.uid())
  or exists (
    select 1
    from public.appointments a
    where a.project_id = project_chat_messages.project_id
      and a.assigned_technician_id = (select auth.uid())
  )
);

create policy "chat_insert_all_roles"
on public.project_chat_messages
for insert
with check (public.current_user_role() in ('admin', 'office', 'technician'));

create policy "chat_update_all_roles"
on public.project_chat_messages
for update
using (public.current_user_role() in ('admin', 'office', 'technician'))
with check (public.current_user_role() in ('admin', 'office', 'technician'));

create policy "chat_delete_all_roles"
on public.project_chat_messages
for delete
using (public.current_user_role() in ('admin', 'office', 'technician'));
