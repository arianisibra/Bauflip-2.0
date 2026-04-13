create index if not exists idx_order_form_templates_org_sort
  on public.order_form_templates (organization_id, sort_order, name);
