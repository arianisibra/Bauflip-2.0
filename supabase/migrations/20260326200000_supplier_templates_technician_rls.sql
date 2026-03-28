-- Allow technicians to read supplier order form templates
drop policy if exists "admin_office_supplier_templates" on public.supplier_order_form_templates;
create policy "all_roles_read_supplier_templates"
  on public.supplier_order_form_templates
  for select
  using (public.current_user_role() in ('admin', 'office', 'technician'));

create policy "admin_office_write_supplier_templates"
  on public.supplier_order_form_templates
  for all
  using (public.current_user_role() in ('admin', 'office'))
  with check (public.current_user_role() in ('admin', 'office'));

-- Allow technicians to insert (draft) supplier submissions
drop policy if exists "admin_office_supplier_submissions" on public.supplier_order_form_submissions;
create policy "all_roles_read_supplier_submissions"
  on public.supplier_order_form_submissions
  for select
  using (public.current_user_role() in ('admin', 'office', 'technician'));

create policy "technician_insert_supplier_submissions"
  on public.supplier_order_form_submissions
  for insert
  with check (public.current_user_role() in ('admin', 'office', 'technician'));

create policy "admin_office_update_supplier_submissions"
  on public.supplier_order_form_submissions
  for update
  using (public.current_user_role() in ('admin', 'office'))
  with check (public.current_user_role() in ('admin', 'office'));

create policy "admin_office_delete_supplier_submissions"
  on public.supplier_order_form_submissions
  for delete
  using (public.current_user_role() in ('admin', 'office'));

-- Allow technicians to read/insert suppliers (needed for ensureDefaultSupplierTemplates)
drop policy if exists "admin_only_suppliers" on public.suppliers;
create policy "all_roles_read_suppliers"
  on public.suppliers
  for select
  using (public.current_user_role() in ('admin', 'office', 'technician'));

create policy "admin_office_write_suppliers"
  on public.suppliers
  for all
  using (public.current_user_role() in ('admin', 'office'))
  with check (public.current_user_role() in ('admin', 'office'));
