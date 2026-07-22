import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WorkflowStage, WorkflowTransition } from "@/lib/domain/workflow-types";

type StageRow = {
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
};

function mapRow(row: StageRow): WorkflowStage {
  return {
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
    .select(
      "key, label, color, sort_order, is_initial, is_scheduling_target, promotes_on_appointment, is_billing, is_terminal, hidden_in_office_filter, rapport_aufgenommen, rapport_montage, rapport_behoben_target, workflows!inner(is_default)",
    )
    .eq("organization_id", organizationId)
    .eq("workflows.is_default", true)
    .order("sort_order");
  if (error || !data) return [];
  return (data as unknown as StageRow[]).map(mapRow);
});

type TransitionRow = {
  from_key: string;
  to_key: string;
  action_label: string;
  sort_order: number;
};

function mapTransitionRow(row: TransitionRow): WorkflowTransition {
  return {
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
    .select("from_key, to_key, action_label, sort_order, workflows!inner(is_default)")
    .eq("organization_id", organizationId)
    .eq("workflows.is_default", true)
    .order("from_key")
    .order("sort_order");
  if (error || !data) return [];
  return (data as unknown as TransitionRow[]).map(mapTransitionRow);
});
