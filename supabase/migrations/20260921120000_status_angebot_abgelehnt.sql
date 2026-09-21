-- Kundenwunsch 21.09.2026 (Gross Storenbau): neuer Status «ANGEBOT ABGELEHNT».
-- Reiner Handstatus: keine Automatik (promotes_on_appointment = false, kein Rapport-Ziel,
-- nicht terminal). Knopf im Büro nur von «OFFERTE GESENDET» aus.
--
-- MUSS VOR dem App-Deploy laufen: Der Trigger `projects_status_dynamic_check`
-- (validate_project_status) lehnt jeden Status ab, der für die Organisation nicht in
-- `workflow_stages` steht. Ohne diese Zeile schlägt «Angebot abgelehnt» mit
-- 'Unbekannter Status' fehl.
--
-- Nur für Organisationen mit der Storenbau-Vorlage (= Kunden auf `main`, deren Status
-- im Code fest verdrahtet sind). Firmen auf bauflip-os pflegen ihre Status selbst im
-- Workflow-Editor und bekommen hier bewusst nichts dazu.
--
-- Idempotent: mehrfaches Ausführen ändert nichts.

insert into public.workflow_stages (
  organization_id, workflow_id, key, label, color, sort_order,
  is_initial, is_scheduling_target, promotes_on_appointment, is_billing, is_terminal,
  hidden_in_office_filter, rapport_aufgenommen, rapport_montage, rapport_behoben_target
)
select w.organization_id, w.id, 'angebot_abgelehnt', 'ANGEBOT ABGELEHNT', 'red', 35,
       false, false, false, false, false,
       false, false, false, false
from public.workflows w
where w.is_default
  and w.template_key = 'storenbau'
on conflict (workflow_id, key) do nothing;

insert into public.workflow_transitions (organization_id, workflow_id, from_key, to_key, action_label, sort_order)
select w.organization_id, w.id, 'offerte_gesendet', 'angebot_abgelehnt', 'ANGEBOT ABGELEHNT', 20
from public.workflows w
where w.is_default
  and w.template_key = 'storenbau'
  and not exists (
    select 1 from public.workflow_transitions t
    where t.workflow_id = w.id
      and t.from_key = 'offerte_gesendet'
      and t.to_key = 'angebot_abgelehnt'
  );
