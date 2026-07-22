-- Korrektur: der Stufe-A-Seed hatte für 'einsatz_offen' das Label 'EINSATZ OFFEN'
-- statt des tatsächlich hartcodierten 'EINSATZ / RAPPORT' (lib/domain/types.ts,
-- projectStatusLabels.einsatz_offen). Wurde beim Byte-für-Byte-Abgleich vor der
-- Stufe-B-Aktivierung gefunden. Korrigiert (a) bereits geseedete Zeilen und
-- (b) die Seed-Funktion, damit künftige Organisationen den richtigen Wert bekommen.

update public.workflow_stages
set label = 'EINSATZ / RAPPORT'
where key = 'einsatz_offen' and label = 'EINSATZ OFFEN';

create or replace function public.seed_storenbau_workflow(p_org uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workflow uuid;
begin
  select id into v_workflow from public.workflows
  where organization_id = p_org and is_default limit 1;
  if v_workflow is not null then
    return v_workflow;
  end if;

  insert into public.workflows (organization_id, name, template_key, is_default)
  values (p_org, 'Storenbau', 'storenbau', true)
  returning id into v_workflow;

  insert into public.workflow_stages (
    organization_id, workflow_id, key, label, color, sort_order,
    is_initial, is_scheduling_target, promotes_on_appointment, is_billing,
    is_terminal, hidden_in_office_filter, rapport_aufgenommen, rapport_montage,
    rapport_behoben_target
  )
  values
    (p_org, v_workflow, 'offen',             'ABMACHEN',          'zinc',    10,  true,  false, true,  false, false, false, false, false, false),
    (p_org, v_workflow, 'abklaeren',         'ABKLÄREN',          'amber',   15,  false, false, false, false, false, false, false, false, false),
    (p_org, v_workflow, 'offerte_senden',    'OFFERTE SENDEN',    'indigo',  20,  false, false, false, false, false, false, true,  false, false),
    (p_org, v_workflow, 'offerte_gesendet',  'OFFERTE GESENDET',  'violet',  30,  false, false, false, false, false, false, false, false, false),
    (p_org, v_workflow, 'offerte_genehmigt', 'OFFERTE GENEHMIGT', 'purple',  40,  false, false, false, false, false, false, false, false, false),
    (p_org, v_workflow, 'bestellen',         'BESTELLEN',         'fuchsia', 50,  false, false, false, false, false, false, true,  false, false),
    (p_org, v_workflow, 'bestellt',          'BESTELLT',          'pink',    60,  false, false, true,  false, false, false, false, false, false),
    (p_org, v_workflow, 'werkstatt',         'WERKSTATT',         'orange',  70,  false, false, true,  false, false, false, true,  true,  false),
    (p_org, v_workflow, 'abholbereit',       'ABHOLBEREIT',       'teal',    80,  false, false, false, false, false, false, false, false, false),
    (p_org, v_workflow, 'montagebereit',     'MONTAGEBEREIT',     'emerald', 90,  false, false, true,  false, false, false, true,  true,  false),
    (p_org, v_workflow, 'einsatz_offen',     'EINSATZ / RAPPORT', 'blue',    95,  false, false, true,  false, false, true,  false, true,  false),
    (p_org, v_workflow, 'abgemacht',         'ABGEMACHT',         'lime',    100, false, true,  false, false, false, false, false, false, false),
    (p_org, v_workflow, 'subunternehmer',    'SUBUNTERNEHMER',    'stone',   110, false, false, false, false, false, false, false, false, false),
    (p_org, v_workflow, 'abrechnen',         'ABRECHNEN',         'yellow',  120, false, false, false, true,  false, false, false, false, true),
    (p_org, v_workflow, 'abgeschlossen',     'ABGESCHLOSSEN',     'green',   130, false, false, false, false, true,  false, false, false, false),
    (p_org, v_workflow, 'garantiefall',      'GARANTIEFALL',      'rose',    140, false, false, true,  false, true,  false, false, false, false);

  insert into public.workflow_transitions (
    organization_id, workflow_id, from_key, to_key, action_label, sort_order
  )
  values
    (p_org, v_workflow, 'offerte_senden',    'offerte_gesendet',  'OFFERTE GESENDET',    10),
    (p_org, v_workflow, 'offerte_gesendet',  'offerte_genehmigt', 'OFFERTE GENEHMIGT',   10),
    (p_org, v_workflow, 'offerte_genehmigt', 'bestellen',         'MATERIAL BESTELLEN',  10),
    (p_org, v_workflow, 'offerte_genehmigt', 'abrechnen',         'DIREKT ABRECHNEN',    20),
    (p_org, v_workflow, 'bestellen',         'bestellt',          'BESTELLT',            10),
    (p_org, v_workflow, 'bestellt',          'montagebereit',     'MATERIAL EINGETROFFEN', 10),
    (p_org, v_workflow, 'bestellt',          'abholbereit',       'ABHOLBEREIT',         20),
    (p_org, v_workflow, 'abholbereit',       'montagebereit',     'ABGEHOLT',            10),
    (p_org, v_workflow, 'werkstatt',         'montagebereit',     'WERKSTATT FERTIG',    10),
    (p_org, v_workflow, 'abklaeren',         'offerte_senden',    'OFFERTE SENDEN',      10),
    (p_org, v_workflow, 'abklaeren',         'bestellen',         'MATERIAL BESTELLEN',  20),
    (p_org, v_workflow, 'subunternehmer',    'abrechnen',         'ABRECHNEN',           10),
    (p_org, v_workflow, 'abrechnen',         'abgeschlossen',     'ABGESCHLOSSEN',       10),
    (p_org, v_workflow, 'abgeschlossen',     'garantiefall',      'GARANTIEFALL MELDEN', 10),
    (p_org, v_workflow, 'garantiefall',      'abgeschlossen',     'ABGESCHLOSSEN',       10);

  return v_workflow;
end $$;
