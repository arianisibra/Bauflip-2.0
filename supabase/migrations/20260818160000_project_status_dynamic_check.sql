-- Workflow-Engine Roadmap Punkt 1: projects.status von einer global hartcodierten
-- CHECK-Constraint (16 Storenbau-Statusnamen) auf eine pro-Organisation dynamische
-- Prüfung umstellen. Voraussetzung dafür, dass Admins im "Workflow"-Editor künftig
-- eigene Status-Keys anlegen/löschen können (aktuell durch den alten Constraint
-- blockiert — siehe workflow_stages_manager.tsx "Key fix wegen CHECK-Constraint").
--
-- Ersetzt KEINE Validierung durch keine Validierung: statt eines festen Namens-Sets
-- prüft ein Trigger gegen workflow_stages.key der jeweiligen Organisation. Jede
-- Organisation MUSS also vor dem ersten Projekt-Write bereits Workflow-Stages
-- besitzen (aktuell: beide bestehenden Orgs — Storenbau + Malerbetrieb Test — haben
-- das per Seed-Funktion; Org-Anlage läuft bisher manuell, nicht über die App).
--
-- Bewusst NICHT angewendet mit dieser Migration selbst — nur vorbereitet, wie
-- vereinbart. Anwendung erst nach erneuter expliziter Freigabe.

alter table public.projects
  drop constraint if exists projects_status_check;

create index if not exists idx_workflow_stages_org_key
  on public.workflow_stages (organization_id, key);

create or replace function public.validate_project_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.workflow_stages ws
    where ws.organization_id = new.organization_id
      and ws.key = new.status
  ) then
    raise exception 'Unbekannter Status "%" für diese Organisation.', new.status
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_status_dynamic_check on public.projects;
create trigger projects_status_dynamic_check
  before insert or update of status on public.projects
  for each row
  execute function public.validate_project_status();
