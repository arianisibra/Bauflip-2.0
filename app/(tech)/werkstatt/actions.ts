"use server";

import { z } from "zod";
import { requireTechFieldSession } from "@/lib/auth/organization";
import { type AktionsFehler } from "@/lib/errors/fach-fehler";
import { publish } from "@/lib/realtime/publish";
import { listWerkstattProjekte, markWerkstattFertig, type WerkstattProjekt } from "@/lib/werkstatt/repository";

export async function listWerkstattProjekteAction(): Promise<WerkstattProjekt[]> {
  const session = await requireTechFieldSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");
  return listWerkstattProjekte(session.organizationId);
}

export async function werkstattFertigAction(
  projectId: unknown,
  tabId?: string,
): Promise<{ ok: true } | AktionsFehler> {
  const session = await requireTechFieldSession();
  if (!session.organizationId) return { ok: false, error: "Keine Organisation." };
  const parsed = z.string().uuid().safeParse(projectId);
  if (!parsed.success) return { ok: false, error: "Ungültiges Projekt." };

  const ergebnis = await markWerkstattFertig(session.organizationId, parsed.data);
  if (ergebnis === "nicht_mehr_in_werkstatt") {
    return {
      ok: false,
      error: "Dieses Projekt steht nicht mehr in der Werkstatt — es wurde bereits weitergeschaltet.",
    };
  }
  await publish(session.organizationId, {
    type: "project.core_changed",
    projectId: parsed.data,
    originTabId: tabId,
  });
  return { ok: true };
}
