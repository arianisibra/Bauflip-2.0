-- Feldschema für supplier_order_form_templates (Tabelle kann durch downsize_core fehlen)
do $migration$
begin
  if to_regclass('public.supplier_order_form_templates') is not null then
    execute $q$
      alter table public.supplier_order_form_templates
        add column if not exists field_schema jsonb not null default '[]'::jsonb
    $q$;
    execute $q$
      update public.supplier_order_form_templates t
      set field_schema = coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'key', f,
            'label', initcap(replace(f, '_', ' ')),
            'type', case
              when lower(f) like '%artikel%' then 'article'
              when lower(f) like '%anzahl%' or lower(f) like '%menge%' or lower(f) like '%_mm' then 'number'
              else 'text'
            end,
            'required', true
          )
        )
        from unnest(t.required_fields) as f
      ), '[]'::jsonb)
      where coalesce(jsonb_array_length(t.field_schema), 0) = 0
    $q$;
  end if;
end
$migration$;
