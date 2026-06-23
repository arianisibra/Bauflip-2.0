"use server";

import { getLayoutSession } from "@/lib/auth/session";
import {
  getProjectCore,
  listActiveOrderFormTemplatesForOrg,
  signAttachmentUrls,
} from "@/lib/db/repository";
import type { ProjectAttachment } from "@/lib/domain/types";
import type { OrderFormTemplate } from "@/lib/domain/types";

export type AuftragExtras = {
  signedAttachments: ProjectAttachment[];
  orderFormTemplates: OrderFormTemplate[];
};

async function assertAuftragAccess(projectId: string) {
  const session = await getLayoutSession();
  if (!session) {
    throw new Error("Nicht angemeldet.");
  }
  const trimmed = projectId.trim();
  if (!trimmed) {
    throw new Error("Projekt-ID fehlt.");
  }

  const core = await getProjectCore(trimmed);
  if (!core) {
    throw new Error("Projekt nicht gefunden.");
  }

  if (session.role === "technician") {
    const isAssigned =
      core.appointments.some((a) => a.assignedTechnicianId === session.userId) ||
      core.project.nextOwnerUserId === session.userId;
    if (!isAssigned) {
      throw new Error("Keine Berechtigung.");
    }
  } else if (session.role === "admin" || session.role === "office") {
    const orgId = core.project.organizationId;
    if (!session.organizationId || !orgId || session.organizationId !== orgId) {
      throw new Error("Keine Berechtigung.");
    }
  } else {
    throw new Error("Keine Berechtigung.");
  }

  return core;
}

/**
 * Signierte Anhang-URLs und Bestellformular-Templates für die Auftragsseite.
 * Läuft nach dem Document-Request, damit TTFB nicht auf Storage/Template-Queries wartet.
 */
export async function fetchAuftragExtrasAction(
  projectId: string,
  skipOrderFormTemplates = false,
): Promise<AuftragExtras> {
  const core = await assertAuftragAccess(projectId);

  const [signedAttachments, orderFormTemplates] = await Promise.all([
    signAttachmentUrls(core.attachments),
    !skipOrderFormTemplates && core.project.organizationId != null
      ? listActiveOrderFormTemplatesForOrg(core.project.organizationId)
      : Promise.resolve([]),
  ]);

  return { signedAttachments, orderFormTemplates };
}

/**
 * Lädt `ProjectCore` inkl. signierter Anhang-URLs für die Auftragsseite.
 * Zugriff wie in `app/(tech)/auftrag/[projectId]/page.tsx`.
 */
export async function fetchAuftragProjectCoreAction(projectId: string) {
  const core = await assertAuftragAccess(projectId);
  const signedAttachments = await signAttachmentUrls(core.attachments);
  return { ...core, attachments: signedAttachments };
}
