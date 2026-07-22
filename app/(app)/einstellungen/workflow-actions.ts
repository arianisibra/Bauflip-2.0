"use server";

import { requireAdminLayoutSession } from "@/lib/auth/organization";
import { getOrgWorkflowStages, updateWorkflowStage } from "@/lib/db/workflow";
import type { WorkflowStage } from "@/lib/domain/workflow-types";
import { workflowStageUpdateSchema } from "@/lib/validations/forms";

export async function getWorkflowStagesAction(): Promise<WorkflowStage[]> {
  const session = await requireAdminLayoutSession();
  return getOrgWorkflowStages(session.organizationId);
}

export async function updateWorkflowStageAction(
  stageId: string,
  values: unknown,
): Promise<WorkflowStage> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");

  const parsed = workflowStageUpdateSchema.safeParse(values);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }

  return updateWorkflowStage(session.organizationId, stageId, parsed.data);
}
