"use server";

import { z } from "zod";
import { requireTechFieldSession } from "@/lib/auth/organization";
import { type AktionsFehler } from "@/lib/errors/fach-fehler";
import { publish } from "@/lib/realtime/publish";
import { markWerkstattFertig } from "@/lib/werkstatt/repository";

export async function werkstattFertigAction(
  projectId: unknown,
  tabId?: string,
): Promise<{ ok: true } | AktionsFehler> {
  const session = await requireTechFieldSession();
  const parsed = z.string().uuid().safeParse(projectId);
  if (!parsed.success) return { ok: false, error: "Ungültiges Projekt." };

  const ergebnis = await markWerkstattFertig(parsed.data);
  if (ergebnis === "nicht_umgeschaltet") {
    return {
      ok: false,
      error: "Der Auftrag steht nicht mehr in der Werkstatt — bitte Seite neu laden.",
    };
  }
  if (session.organizationId) {
    await publish(session.organizationId, {
      type: "project.core_changed",
      projectId: parsed.data,
      originTabId: tabId,
    });
  }
  return { ok: true };
}
