-- Supplier-/Lieferanten-Tabellen können durch downsize_core fehlen — Policies nur anlegen wenn Tabellen existieren.
do $migration$
begin
  if to_regclass('public.supplier_order_form_templates') is not null then
    execute 'drop policy if exists "admin_office_supplier_templates" on public.supplier_order_form_templates';
    execute 'drop policy if exists "all_roles_read_supplier_templates" on public.supplier_order_form_templates';
    execute 'drop policy if exists "admin_office_write_supplier_templates" on public.supplier_order_form_templates';
    execute $p$
      create policy "all_roles_read_supplier_templates"
        on public.supplier_order_form_templates
        for select
        using (public.current_user_role() in ('admin', 'office', 'technician'))
    $p$;
    execute $p$
      create policy "admin_office_write_supplier_templates"
        on public.supplier_order_form_templates
        for all
        using (public.current_user_role() in ('admin', 'office'))
        with check (public.current_user_role() in ('admin', 'office'))
    $p$;
  end if;

  if to_regclass('public.supplier_order_form_submissions') is not null then
    execute 'drop policy if exists "admin_office_supplier_submissions" on public.supplier_order_form_submissions';
    execute 'drop policy if exists "all_roles_read_supplier_submissions" on public.supplier_order_form_submissions';
    execute 'drop policy if exists "technician_insert_supplier_submissions" on public.supplier_order_form_submissions';
    execute 'drop policy if exists "admin_office_update_supplier_submissions" on public.supplier_order_form_submissions';
    execute 'drop policy if exists "admin_office_delete_supplier_submissions" on public.supplier_order_form_submissions';
    execute $p$
      create policy "all_roles_read_supplier_submissions"
        on public.supplier_order_form_submissions
        for select
        using (public.current_user_role() in ('admin', 'office', 'technician'))
    $p$;
    execute $p$
      create policy "technician_insert_supplier_submissions"
        on public.supplier_order_form_submissions
        for insert
        with check (public.current_user_role() in ('admin', 'office', 'technician'))
    $p$;
    execute $p$
      create policy "admin_office_update_supplier_submissions"
        on public.supplier_order_form_submissions
        for update
        using (public.current_user_role() in ('admin', 'office'))
        with check (public.current_user_role() in ('admin', 'office'))
    $p$;
    execute $p$
      create policy "admin_office_delete_supplier_submissions"
        on public.supplier_order_form_submissions
        for delete
        using (public.current_user_role() in ('admin', 'office'))
    $p$;
  end if;

  if to_regclass('public.suppliers') is not null then
    execute 'drop policy if exists "admin_only_suppliers" on public.suppliers';
    execute 'drop policy if exists "all_roles_read_suppliers" on public.suppliers';
    execute 'drop policy if exists "admin_office_write_suppliers" on public.suppliers';
    execute $p$
      create policy "all_roles_read_suppliers"
        on public.suppliers
        for select
        using (public.current_user_role() in ('admin', 'office', 'technician'))
    $p$;
    execute $p$
      create policy "admin_office_write_suppliers"
        on public.suppliers
        for all
        using (public.current_user_role() in ('admin', 'office'))
        with check (public.current_user_role() in ('admin', 'office'))
    $p$;
  end if;
end
$migration$;
