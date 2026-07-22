"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WorkflowTransition } from "@/lib/domain/workflow-types";

/**
 * Stellt die Übergänge (Pipeline-Knöpfe) des Org-Workflows bereit. Default =
 * leeres Array: fehlt der Provider (oder ist noch nicht geseedet), fallen
 * die Resolver auf das hartcodierte STATUS_PIPELINE zurück — nichts bricht.
 */
const WorkflowTransitionsContext = createContext<readonly WorkflowTransition[]>([]);

export function WorkflowTransitionsProvider({
  value,
  children,
}: {
  value: readonly WorkflowTransition[];
  children: ReactNode;
}) {
  return (
    <WorkflowTransitionsContext.Provider value={value}>{children}</WorkflowTransitionsContext.Provider>
  );
}

export function useWorkflowTransitions(): readonly WorkflowTransition[] {
  return useContext(WorkflowTransitionsContext);
}
