-- Audit-Härtung: Signatur-Data-URLs (10–50 KB pro Rapport) nicht mehr in Listen-/
-- Bootstrap-Payloads mitschicken. Anzeige lädt die Signatur on-demand beim Aufklappen.
-- has_signature (generated) ersetzt die Data-URL als billiger Indikator.

alter table public.technician_reports
  add column if not exists has_signature boolean
  generated always as (signature_data_url is not null) stored;

comment on column public.technician_reports.has_signature is
  'Abgeleitet: Kundensignatur vorhanden (Listen-Indikator ohne Data-URL-Payload).';

-- project_core_bootstrap: identisch zu 20260701120000, aber Reports ohne signature_data_url
-- (to_jsonb(tr) - Key). has_signature ist als Stored-Column automatisch enthalten.
create or replace function public.project_core_bootstrap(p_project_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'project',
    to_jsonb(p),
    'appointments',
    coalesce(
      (
        select jsonb_agg(
          to_jsonb(a) || jsonb_build_object(
            'technician_display_name',
            nullif(trim(pr.display_name), '')
          )
          order by a.starts_at
        )
        from public.appointments a
        left join public.profiles pr on pr.id = a.assigned_technician_id
        where a.project_id = p_project_id
      ),
      '[]'::jsonb
    ),
    'attachments',
    coalesce(
      (
        select jsonb_agg(to_jsonb(att) order by att.created_at)
        from public.project_attachments att
        where att.project_id = p_project_id
      ),
      '[]'::jsonb
    ),
    'reports',
    coalesce(
      (
        select jsonb_agg(
          (to_jsonb(tr) - 'signature_data_url') || jsonb_build_object(
            'orderForms',
            coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'templateId', trof.template_id,
                    'templateName', oft.name,
                    'fields', oft.fields,
                    'values', trof.values_json
                  )
                )
                from public.technician_report_order_forms trof
                inner join public.order_form_templates oft on oft.id = trof.template_id
                where trof.technician_report_id = tr.id
              ),
              '[]'::jsonb
            )
          )
          order by tr.created_at
        )
        from public.technician_reports tr
        where tr.project_id = p_project_id
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from public.projects p
  where p.id = p_project_id;

  return v_result;
end;
$$;
