-- Verallgemeinerter Standard-Workflow für neu registrierte Organisationen.
--
-- Bisher bekam jede neue Firma über seed_storenbau_workflow einen Workflow
-- namens «Storenbau» mit branchenspezifischen Beschriftungen (WERKSTATT,
-- MONTAGEBEREIT). Für einen Malerbetrieb oder ein anderes Gewerbe ist das
-- irreführend.
--
-- Diese Fassung ist gewerbeneutral. Die Stage-KEYS bleiben bewusst identisch —
-- sie sind interne Bezeichner und stecken als fester Typ `ProjectStatus` im
-- Anwendungscode; nur Name und sichtbare Beschriftungen ändern sich. Jede
-- Organisation kann Beschriftungen anschliessend im Workflow-Editor anpassen
-- oder nicht benötigte Schritte löschen.
--
-- seed_storenbau_workflow bleibt unverändert bestehen: Gross Storenbau und
-- bestehende Organisationen behalten ihren Workflow.

create or replace function public.seed_default_workflow(p_org uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_workflow uuid;
begin
  -- Idempotent: existiert schon eine Standard-Vorlage, nichts tun.
  select id into v_workflow from public.workflows
  where organization_id = p_org and is_default limit 1;
  if v_workflow is not null then
    return v_workflow;
  end if;

  insert into public.workflows (organization_id, name, template_key, is_default)
  values (p_org, 'Standard', 'standard', true)
  returning id into v_workflow;

  insert into public.workflow_stages (
    organization_id, workflow_id, key, label, color, sort_order,
    is_initial, is_scheduling_target, promotes_on_appointment, is_billing,
    is_terminal, hidden_in_office_filter, rapport_aufgenommen, rapport_montage,
    rapport_behoben_target, rapport_next_step_description, rapport_next_step_icon
  )
  values
    (p_org, v_workflow, 'offen',             'ANFRAGE',            'zinc',    10,  true,  false, true,  false, false, false, false, false, false, null, null),
    (p_org, v_workflow, 'abklaeren',         'ABKLÄREN',           'amber',   15,  false, false, false, false, false, false, false, false, false, null, null),
    (p_org, v_workflow, 'offerte_senden',    'OFFERTE SENDEN',     'indigo',  20,  false, false, false, false, false, false, true,  false, false, 'Aufnahme gemacht, Offerte erstellen', 'shopping_cart'),
    (p_org, v_workflow, 'offerte_gesendet',  'OFFERTE GESENDET',   'violet',  30,  false, false, false, false, false, false, false, false, false, null, null),
    (p_org, v_workflow, 'offerte_genehmigt', 'OFFERTE GENEHMIGT',  'purple',  40,  false, false, false, false, false, false, false, false, false, null, null),
    (p_org, v_workflow, 'bestellen',         'MATERIAL BESTELLEN', 'fuchsia', 50,  false, false, false, false, false, false, true,  false, false, 'Direkt bestellen, keine Offerte nötig', 'shopping_cart'),
    (p_org, v_workflow, 'bestellt',          'MATERIAL BESTELLT',  'pink',    60,  false, false, true,  false, false, false, false, false, false, null, null),
    (p_org, v_workflow, 'werkstatt',         'VORBEREITUNG',       'orange',  70,  false, false, true,  false, false, false, true,  true,  false, 'Muss zuerst vorbereitet werden', 'truck'),
    (p_org, v_workflow, 'abholbereit',       'ABHOLBEREIT',        'teal',    80,  false, false, false, false, false, false, false, false, false, null, null),
    (p_org, v_workflow, 'montagebereit',     'BEREIT FÜR EINSATZ', 'emerald', 90,  false, false, true,  false, false, false, true,  true,  false, 'Bereit für die Ausführung', 'check_circle'),
    (p_org, v_workflow, 'einsatz_offen',     'EINSATZ / RAPPORT',  'blue',    95,  false, false, true,  false, false, true,  false, true,  false, 'Arbeit nicht abgeschlossen, Büro plant neuen Termin', 'clock'),
    (p_org, v_workflow, 'abgemacht',         'TERMIN FIX',         'lime',    100, false, true,  false, false, false, false, false, false, false, null, null),
    (p_org, v_workflow, 'subunternehmer',    'SUBUNTERNEHMER',     'stone',   110, false, false, false, false, false, false, false, false, false, null, null),
    (p_org, v_workflow, 'abrechnen',         'ABRECHNEN',          'yellow',  120, false, false, false, true,  false, false, false, false, true,  null, null),
    (p_org, v_workflow, 'abgeschlossen',     'ABGESCHLOSSEN',      'green',   130, false, false, false, false, true,  false, false, false, false, null, null),
    (p_org, v_workflow, 'garantiefall',      'GARANTIEFALL',       'rose',    140, false, false, true,  false, true,  false, false, false, false, null, null);

  insert into public.workflow_transitions (
    organization_id, workflow_id, from_key, to_key, action_label, sort_order
  )
  values
    (p_org, v_workflow, 'offerte_senden',    'offerte_gesendet',  'OFFERTE GESENDET',      10),
    (p_org, v_workflow, 'offerte_gesendet',  'offerte_genehmigt', 'OFFERTE GENEHMIGT',     10),
    (p_org, v_workflow, 'offerte_genehmigt', 'bestellen',         'MATERIAL BESTELLEN',    10),
    (p_org, v_workflow, 'offerte_genehmigt', 'abrechnen',         'DIREKT ABRECHNEN',      20),
    (p_org, v_workflow, 'bestellen',         'bestellt',          'BESTELLT',              10),
    (p_org, v_workflow, 'bestellt',          'montagebereit',     'MATERIAL EINGETROFFEN', 10),
    (p_org, v_workflow, 'bestellt',          'abholbereit',       'ABHOLBEREIT',           20),
    (p_org, v_workflow, 'abholbereit',       'montagebereit',     'ABGEHOLT',              10),
    (p_org, v_workflow, 'werkstatt',         'montagebereit',     'VORBEREITUNG FERTIG',   10),
    (p_org, v_workflow, 'abklaeren',         'offerte_senden',    'OFFERTE SENDEN',        10),
    (p_org, v_workflow, 'abklaeren',         'bestellen',         'MATERIAL BESTELLEN',    20),
    (p_org, v_workflow, 'subunternehmer',    'abrechnen',         'ABRECHNEN',             10),
    (p_org, v_workflow, 'abrechnen',         'abgeschlossen',     'ABGESCHLOSSEN',         10),
    (p_org, v_workflow, 'abgeschlossen',     'garantiefall',      'GARANTIEFALL MELDEN',   10),
    (p_org, v_workflow, 'garantiefall',      'abgeschlossen',     'ABGESCHLOSSEN',         10);

  return v_workflow;
end $function$;

grant execute on function public.seed_default_workflow(uuid) to service_role;
