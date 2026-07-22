"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WorkflowStage } from "@/lib/domain/workflow-types";

/**
 * Stellt die Stages des Org-Workflows für die Anzeige bereit (Labels/Farben).
 * Default = leeres Array: fehlt der Provider (oder ist noch nicht geseedet),
 * fallen die Resolver auf die hartcodierten Werte zurück — nichts bricht.
 */
const WorkflowStagesContext = createContext<readonly WorkflowStage[]>([]);

export function WorkflowStagesProvider({
  value,
  children,
}: {
  value: readonly WorkflowStage[];
  children: ReactNode;
}) {
  return <WorkflowStagesContext.Provider value={value}>{children}</WorkflowStagesContext.Provider>;
}

export function useWorkflowStages(): readonly WorkflowStage[] {
  return useContext(WorkflowStagesContext);
}
