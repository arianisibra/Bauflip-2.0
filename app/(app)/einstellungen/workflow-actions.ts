"use server";

import { requireAdminLayoutSession } from "@/lib/auth/organization";
import {
  createWorkflowStage,
  createWorkflowTransition,
  deleteWorkflowStage,
  deleteWorkflowTransition,
  getOrgWorkflowStages,
  getOrgWorkflowTransitions,
  updateWorkflowStage,
  updateWorkflowTransition,
} from "@/lib/db/workflow";
import type { WorkflowStage, WorkflowTransition } from "@/lib/domain/workflow-types";
import {
  workflowStageCreateSchema,
  workflowStageUpdateSchema,
  workflowTransitionInputSchema,
} from "@/lib/validations/forms";

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

export async function createWorkflowStageAction(values: unknown): Promise<WorkflowStage> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");

  const parsed = workflowStageCreateSchema.safeParse(values);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }

  return createWorkflowStage(session.organizationId, parsed.data);
}

export async function deleteWorkflowStageAction(stageId: string): Promise<void> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");

  return deleteWorkflowStage(session.organizationId, stageId);
}

export async function getWorkflowTransitionsAction(): Promise<WorkflowTransition[]> {
  const session = await requireAdminLayoutSession();
  return getOrgWorkflowTransitions(session.organizationId);
}

export async function createWorkflowTransitionAction(values: unknown): Promise<WorkflowTransition> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");

  const parsed = workflowTransitionInputSchema.safeParse(values);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }

  return createWorkflowTransition(session.organizationId, parsed.data);
}

export async function updateWorkflowTransitionAction(
  transitionId: string,
  values: unknown,
): Promise<WorkflowTransition> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");

  const parsed = workflowTransitionInputSchema.safeParse(values);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }

  return updateWorkflowTransition(session.organizationId, transitionId, parsed.data);
}

export async function deleteWorkflowTransitionAction(transitionId: string): Promise<void> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");

  return deleteWorkflowTransition(session.organizationId, transitionId);
}
