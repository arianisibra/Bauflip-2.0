-- Stufe A der Workflow-Engine: rein additiv, kein Verhalten geändert.
-- Legt drei neue Tabellen an (workflows / workflow_stages / workflow_transitions)
-- und seedet jede bestehende Organisation mit der «Storenbau»-Vorlage, die exakt
-- den heute hartcodierten Ablauf abbildet. Die Live-App liest diese Tabellen NICHT
-- und schreibt weiter `projects.status` als Text — für die Produktion unsichtbar.
--
-- Der globale CHECK-Constraint auf projects.status bleibt hier BEWUSST bestehen
-- (fällt erst in einer späteren Stufe, wenn die App auf die Config umgestellt ist).

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Tabellen
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  template_key text,                       -- 'storenbau' | 'maler' | ...
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Eine Standard-Vorlage pro Organisation.
create unique index if not exists workflows_one_default_per_org
  on public.workflows (organization_id)
  where is_default;

create table if not exists public.workflow_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  key text not null,                       -- entspricht projects.status, z. B. 'bestellt'
  label text not null,                     -- Anzeigename, z. B. 'BESTELLT'
  color text not null default 'gray',      -- semantischer Farb-Key (kein CSS)
  sort_order integer not null default 0,
  -- Semantische Tags: die Automatiken beziehen sich hierauf, NICHT auf Namen.
  is_initial boolean not null default false,             -- Backlog / Standard-Rückfall
  is_scheduling_target boolean not null default false,   -- «=abgemacht»: Ziel bei Terminbuchung
  promotes_on_appointment boolean not null default false,-- von hier bei Termin → scheduling_target
  is_billing boolean not null default false,             -- «=abrechnen»
  is_terminal boolean not null default false,            -- «=abgeschlossen»/Garantie
  hidden_in_office_filter boolean not null default false,
  rapport_aufgenommen boolean not null default false,    -- Rapport «aufgenommen» bietet diese Stage an
  rapport_montage boolean not null default false,        -- Rapport «Montage/Folge» bietet diese Stage an
  rapport_behoben_target boolean not null default false, -- Rapport «behoben» → diese Stage
  created_at timestamptz not null default now(),
  unique (workflow_id, key)
);

create index if not exists workflow_stages_workflow_idx
  on public.workflow_stages (workflow_id, sort_order);

create table if not exists public.workflow_transitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  from_key text not null,
  to_key text not null,
  action_label text not null,              -- Knopfbeschriftung, z. B. 'BESTELLT'
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists workflow_transitions_workflow_idx
  on public.workflow_transitions (workflow_id, from_key, sort_order);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. RLS — Org-scoped lesen (alle aktiven Mitglieder), schreiben nur Admin.
--    Muster wie bei `contacts` (current_user_role() + organization_memberships).
-- ────────────────────────────────────────────────────────────────────────────

alter table public.workflows enable row level security;
alter table public.workflow_stages enable row level security;
alter table public.workflow_transitions enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['workflows', 'workflow_stages', 'workflow_transitions']
  loop
    execute format('drop policy if exists %1$I_read_org on public.%1$I;', t);
    execute format('drop policy if exists %1$I_write_admin on public.%1$I;', t);

    execute format($f$
      create policy %1$I_read_org on public.%1$I
      for select using (
        organization_id in (
          select om.organization_id from public.organization_memberships om
          where om.user_id = (select auth.uid()) and om.is_active
        )
      );
    $f$, t);

    execute format($f$
      create policy %1$I_write_admin on public.%1$I
      for all using (
        current_user_role() = 'admin'::app_role
        and organization_id in (
          select om.organization_id from public.organization_memberships om
          where om.user_id = (select auth.uid()) and om.is_active
        )
      ) with check (
        current_user_role() = 'admin'::app_role
        and organization_id in (
          select om.organization_id from public.organization_memberships om
          where om.user_id = (select auth.uid()) and om.is_active
        )
      );
    $f$, t);
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Seed-Funktion: erzeugt die «Storenbau»-Vorlage für eine Organisation.
--    Wiederverwendbar (später vom Onboarding aufrufbar). Idempotent pro Org.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.seed_storenbau_workflow(p_org uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workflow uuid;
begin
  -- Existiert schon eine Standard-Vorlage? Dann nichts tun.
  select id into v_workflow from public.workflows
  where organization_id = p_org and is_default limit 1;
  if v_workflow is not null then
    return v_workflow;
  end if;

  insert into public.workflows (organization_id, name, template_key, is_default)
  values (p_org, 'Storenbau', 'storenbau', true)
  returning id into v_workflow;

  -- Stages: key, label, color, sort, is_initial, scheduling_target, promotes,
  --         is_billing, is_terminal, hidden_filter, rap_aufg, rap_mont, rap_beh
  insert into public.workflow_stages (
    organization_id, workflow_id, key, label, color, sort_order,
    is_initial, is_scheduling_target, promotes_on_appointment, is_billing,
    is_terminal, hidden_in_office_filter, rapport_aufgenommen, rapport_montage,
    rapport_behoben_target
  )
  values
    (p_org, v_workflow, 'offen',             'ABMACHEN',         'zinc',    10,  true,  false, true,  false, false, false, false, false, false),
    (p_org, v_workflow, 'abklaeren',         'ABKLÄREN',         'amber',   15,  false, false, false, false, false, false, false, false, false),
    (p_org, v_workflow, 'offerte_senden',    'OFFERTE SENDEN',   'indigo',  20,  false, false, false, false, false, false, true,  false, false),
    (p_org, v_workflow, 'offerte_gesendet',  'OFFERTE GESENDET', 'violet',  30,  false, false, false, false, false, false, false, false, false),
    (p_org, v_workflow, 'offerte_genehmigt', 'OFFERTE GENEHMIGT','purple',  40,  false, false, false, false, false, false, false, false, false),
    (p_org, v_workflow, 'bestellen',         'BESTELLEN',        'fuchsia', 50,  false, false, false, false, false, false, true,  false, false),
    (p_org, v_workflow, 'bestellt',          'BESTELLT',         'pink',    60,  false, false, true,  false, false, false, false, false, false),
    (p_org, v_workflow, 'werkstatt',         'WERKSTATT',        'orange',  70,  false, false, true,  false, false, false, true,  true,  false),
    (p_org, v_workflow, 'abholbereit',       'ABHOLBEREIT',      'teal',    80,  false, false, false, false, false, false, false, false, false),
    (p_org, v_workflow, 'montagebereit',     'MONTAGEBEREIT',    'emerald', 90,  false, false, true,  false, false, false, true,  true,  false),
    (p_org, v_workflow, 'einsatz_offen',     'EINSATZ OFFEN',    'blue',    95,  false, false, true,  false, false, true,  false, true,  false),
    (p_org, v_workflow, 'abgemacht',         'ABGEMACHT',        'lime',    100, false, true,  false, false, false, false, false, false, false),
    (p_org, v_workflow, 'subunternehmer',    'SUBUNTERNEHMER',   'stone',   110, false, false, false, false, false, false, false, false, false),
    (p_org, v_workflow, 'abrechnen',         'ABRECHNEN',        'yellow',  120, false, false, false, true,  false, false, false, false, true),
    (p_org, v_workflow, 'abgeschlossen',     'ABGESCHLOSSEN',    'green',   130, false, false, false, false, true,  false, false, false, false),
    (p_org, v_workflow, 'garantiefall',      'GARANTIEFALL',     'rose',    140, false, false, true,  false, true,  false, false, false, false);

  -- Transitions (aus dem heutigen STATUS_PIPELINE).
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

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Bestehende Organisationen seeden (idempotent).
-- ────────────────────────────────────────────────────────────────────────────

do $$
declare
  org record;
begin
  for org in select id from public.organizations loop
    perform public.seed_storenbau_workflow(org.id);
  end loop;
end $$;
