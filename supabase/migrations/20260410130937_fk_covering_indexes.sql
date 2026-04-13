-- Supabase linter 0001_unindexed_foreign_keys: index FK columns for deletes/lookups on referenced tables.

create index if not exists idx_invitations_invited_by
  on public.invitations (invited_by);

create index if not exists idx_organizations_created_by
  on public.organizations (created_by);

create index if not exists idx_technician_report_order_forms_template_id
  on public.technician_report_order_forms (template_id);
