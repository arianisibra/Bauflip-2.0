/**
 * Eine Stage aus der konfigurierbaren Workflow-Engine (Tabelle `workflow_stages`).
 * Reiner Typ (kein Server-/Client-Code) — von Loader UND Provider nutzbar.
 */
export type WorkflowStage = {
  key: string;
  label: string;
  color: string;
  sortOrder: number;
  isInitial: boolean;
  isSchedulingTarget: boolean;
  promotesOnAppointment: boolean;
  isBilling: boolean;
  isTerminal: boolean;
  hiddenInOfficeFilter: boolean;
  rapportAufgenommen: boolean;
  rapportMontage: boolean;
  rapportBehobenTarget: boolean;
};

/**
 * Ein Übergang aus der konfigurierbaren Workflow-Engine (Tabelle
 * `workflow_transitions`) — ein Pipeline-Knopf im Projekt-Sheet.
 */
export type WorkflowTransition = {
  fromKey: string;
  toKey: string;
  actionLabel: string;
  sortOrder: number;
};
