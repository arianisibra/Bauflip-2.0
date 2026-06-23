-- PR-I / Tier 1: project sheet core in one roundtrip (project + appointments + attachments + reports).

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
          to_jsonb(tr) || jsonb_build_object(
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

comment on function public.project_core_bootstrap(uuid) is
  'Office project sheet: project row + appointments (with technician name) + attachments + reports with order forms in one call. RLS via security invoker.';

grant execute on function public.project_core_bootstrap(uuid) to authenticated;
