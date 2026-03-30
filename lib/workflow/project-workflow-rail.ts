import type { ProjectStatus } from "@/lib/domain/types";

/**
 * Die 8 Phasen des Büro-Ablaufs für ein einzelnes Projekt.
 * Basiert auf dem definierten 18-Schritt-Prozess (zusammengefasst in operative Phasen).
 */
export const PROJECT_WORKFLOW_STEPS = [
  {
    id: "eingang",
    label: "Auftragseingang & Erfassung",
    hint: "Eingang, Kunde, Problem & Hinweise",
  },
  {
    id: "termin",
    label: "Ersttermin / Aufmass",
    hint: "Termin vereinbaren & Monteur informieren",
  },
  {
    id: "rapport",
    label: "Rapport & Bestandsaufnahme",
    hint: "Diagnose, Masse, Fotos, Entscheid vor Ort",
  },
  {
    id: "offerte",
    label: "Offerte & Freigabe",
    hint: "Angebot erstellen, versenden & Kundenbestätigung",
  },
  {
    id: "bestellung",
    label: "Material & Bestellung",
    hint: "Lager prüfen, Lieferant bestellen",
  },
  {
    id: "ausfuehrung",
    label: "Ausführungstermin",
    hint: "2. Termin, Zugang & Schlüssel",
  },
  {
    id: "fertigmeldung",
    label: "Montage & Fertigmeldung",
    hint: "Arbeit ausführen, rapportieren & Zeit erfassen",
  },
  {
    id: "rechnung",
    label: "Rechnung & Abschluss",
    hint: "Rechnung prüfen, senden & Projekt abschliessen",
  },
] as const;

export type ProjectWorkflowStepId = (typeof PROJECT_WORKFLOW_STEPS)[number]["id"];

/** Status → Phase (0–7). Dient der Hervorhebung «Sie sind hier» im Rail. */
export function getWorkflowPhaseIndex(status: ProjectStatus): number {
  const map: Record<ProjectStatus, number> = {
    // Phase 0 — Eingang & Erfassung
    anfrage: 0,
    // Phase 1 — Ersttermin / Aufmass
    termin_geplant: 1,
    // Phase 2 — Rapport & Bestandsaufnahme
    besichtigung: 2,
    bericht_ausstehend: 2,
    bericht_fertig: 2,
    // Phase 3 — Offerte & Freigabe
    offerte_in_arbeit: 3,
    offerte_gesendet: 3,
    genehmigt: 3,
    // Phase 4 — Material & Bestellung
    bestellung: 4,
    bestellt: 4,
    // Phase 5 — Ausführungstermin
    ware_eingetroffen: 5,
    ausfuehrung_geplant: 5,
    // Phase 6 — Montage & Fertigmeldung
    ausfuehrung_erledigt: 6,
    // Phase 7 — Rechnung & Abschluss
    rechnung: 7,
    abgeschlossen: 7,
  };
  return map[status];
}
