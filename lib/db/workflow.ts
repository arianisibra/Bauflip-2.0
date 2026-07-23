import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WorkflowStage, WorkflowTransition } from "@/lib/domain/workflow-types";

type StageRow = {
  id: string;
  key: string;
  label: string;
  color: string;
  sort_order: number;
  is_initial: boolean;
  is_scheduling_target: boolean;
  promotes_on_appointment: boolean;
  is_billing: boolean;
  is_terminal: boolean;
  hidden_in_office_filter: boolean;
  rapport_aufgenommen: boolean;
  rapport_montage: boolean;
  rapport_behoben_target: boolean;
  rapport_next_step_description: string | null;
  rapport_next_step_icon: string | null;
};

const STAGE_COLUMNS =
  "id, key, label, color, sort_order, is_initial, is_scheduling_target, promotes_on_appointment, is_billing, is_terminal, hidden_in_office_filter, rapport_aufgenommen, rapport_montage, rapport_behoben_target, rapport_next_step_description, rapport_next_step_icon";

function mapRow(row: StageRow): WorkflowStage {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    color: row.color,
    sortOrder: row.sort_order,
    isInitial: row.is_initial,
    isSchedulingTarget: row.is_scheduling_target,
    promotesOnAppointment: row.promotes_on_appointment,
    isBilling: row.is_billing,
    isTerminal: row.is_terminal,
    hiddenInOfficeFilter: row.hidden_in_office_filter,
    rapportAufgenommen: row.rapport_aufgenommen,
    rapportMontage: row.rapport_montage,
    rapportBehobenTarget: row.rapport_behoben_target,
    rapportNextStepDescription: row.rapport_next_step_description,
    rapportNextStepIcon: row.rapport_next_step_icon,
  };
}

/**
 * Stages des Standard-Workflows einer Organisation. Leeres Array bei fehlender
 * Org / Fehler / (noch) nicht geseedet → die Anzeige fällt dann auf die
 * hartcodierten Werte zurück (identisches Verhalten). Nie ein Fehler nach oben.
 */
export const getOrgWorkflowStages = cache(async function getOrgWorkflowStages(
  organizationId: string | null,
): Promise<WorkflowStage[]> {
  if (!organizationId) return [];
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("workflow_stages")
    .select(`${STAGE_COLUMNS}, workflows!inner(is_default)`)
    .eq("organization_id", organizationId)
    .eq("workflows.is_default", true)
    .order("sort_order");
  if (error || !data) return [];
  return (data as unknown as StageRow[]).map(mapRow);
});

type TransitionRow = {
  id: string;
  from_key: string;
  to_key: string;
  action_label: string;
  sort_order: number;
};

const TRANSITION_COLUMNS = "id, from_key, to_key, action_label, sort_order";

function mapTransitionRow(row: TransitionRow): WorkflowTransition {
  return {
    id: row.id,
    fromKey: row.from_key,
    toKey: row.to_key,
    actionLabel: row.action_label,
    sortOrder: row.sort_order,
  };
}

/**
 * Übergänge (Pipeline-Knöpfe) des Standard-Workflows einer Organisation.
 * Leeres Array bei fehlender Org / Fehler / (noch) nicht geseedet → die
 * Anzeige fällt dann auf das hartcodierte STATUS_PIPELINE zurück. Nie ein
 * Fehler nach oben.
 */
export const getOrgWorkflowTransitions = cache(async function getOrgWorkflowTransitions(
  organizationId: string | null,
): Promise<WorkflowTransition[]> {
  if (!organizationId) return [];
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("workflow_transitions")
    .select(`${TRANSITION_COLUMNS}, workflows!inner(is_default)`)
    .eq("organization_id", organizationId)
    .eq("workflows.is_default", true)
    .order("from_key")
    .order("sort_order");
  if (error || !data) return [];
  return (data as unknown as TransitionRow[]).map(mapTransitionRow);
});

/** ID des Standard-Workflows einer Org — legt ihn an, falls (noch) keiner existiert (z. B. neue Org ohne Seed). */
async function ensureDefaultWorkflowId(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  organizationId: string,
): Promise<string> {
  const { data: existing, error: existingError } = await supabase
    .from("workflows")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_default", true)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return (existing as { id: string }).id;

  const { data: created, error: createError } = await supabase
    .from("workflows")
    .insert({ organization_id: organizationId, name: "Standard", is_default: true })
    .select("id")
    .single();
  if (createError || !created) throw new Error(createError?.message ?? "Workflow konnte nicht angelegt werden.");
  return (created as { id: string }).id;
}

/**
 * Übergänge referenzieren nur Stage-Keys, die bereits existieren (UI erzwingt
 * das über eine Auswahlliste) — anders als bei Stages ist hier also Anlegen/
 * Löschen unbedenklich, kein CHECK-Constraint-Bezug.
 */
export type WorkflowTransitionInput = Omit<WorkflowTransition, "id">;

function transitionInputToRow(input: WorkflowTransitionInput) {
  return {
    from_key: input.fromKey,
    to_key: input.toKey,
    action_label: input.actionLabel,
    sort_order: input.sortOrder,
  };
}

export async function createWorkflowTransition(
  organizationId: string,
  input: WorkflowTransitionInput,
): Promise<WorkflowTransition> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Keine Datenbankverbindung.");
  const workflowId = await ensureDefaultWorkflowId(supabase, organizationId);
  const { data, error } = await supabase
    .from("workflow_transitions")
    .insert({ organization_id: organizationId, workflow_id: workflowId, ...transitionInputToRow(input) })
    .select(TRANSITION_COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Übergang konnte nicht angelegt werden.");
  return mapTransitionRow(data as unknown as TransitionRow);
}

export async function updateWorkflowTransition(
  organizationId: string,
  transitionId: string,
  input: WorkflowTransitionInput,
): Promise<WorkflowTransition> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Keine Datenbankverbindung.");
  const { data, error } = await supabase
    .from("workflow_transitions")
    .update(transitionInputToRow(input))
    .eq("id", transitionId)
    .eq("organization_id", organizationId)
    .select(TRANSITION_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Übergang nicht gefunden.");
  return mapTransitionRow(data as unknown as TransitionRow);
}

export async function deleteWorkflowTransition(organizationId: string, transitionId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Keine Datenbankverbindung.");
  const { error } = await supabase
    .from("workflow_transitions")
    .delete()
    .eq("id", transitionId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
}

/**
 * Editierbare Felder einer Stage — bewusst OHNE `key`: der Key ist über den
 * CHECK-Constraint auf `projects.status` verdrahtet (siehe Stufe-D-Notizen),
 * neue/umbenannte Keys sind erst nutzbar, sobald dieser Constraint dynamisch
 * wird. Bis dahin lassen sich nur Anzeige (Label/Farbe/Reihenfolge) und die
 * Automatik-Tags bestehender Stages anpassen.
 */
export type WorkflowStageUpdateInput = Omit<WorkflowStage, "id" | "key">;

function stageUpdateToRow(input: WorkflowStageUpdateInput) {
  return {
    label: input.label,
    color: input.color,
    sort_order: input.sortOrder,
    is_initial: input.isInitial,
    is_scheduling_target: input.isSchedulingTarget,
    promotes_on_appointment: input.promotesOnAppointment,
    is_billing: input.isBilling,
    is_terminal: input.isTerminal,
    hidden_in_office_filter: input.hiddenInOfficeFilter,
    rapport_aufgenommen: input.rapportAufgenommen,
    rapport_montage: input.rapportMontage,
    rapport_behoben_target: input.rapportBehobenTarget,
    rapport_next_step_description: input.rapportNextStepDescription,
    rapport_next_step_icon: input.rapportNextStepIcon,
  };
}

export async function updateWorkflowStage(
  organizationId: string,
  stageId: string,
  input: WorkflowStageUpdateInput,
): Promise<WorkflowStage> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Keine Datenbankverbindung.");
  const { data, error } = await supabase
    .from("workflow_stages")
    .update(stageUpdateToRow(input))
    .eq("id", stageId)
    .eq("organization_id", organizationId)
    .select(STAGE_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Status nicht gefunden.");
  return mapRow(data as unknown as StageRow);
}
