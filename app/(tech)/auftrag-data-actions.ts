"use server";

import { getLayoutSession } from "@/lib/auth/session";
import { getProjectCore, signAttachmentUrls } from "@/lib/db/repository";
import type { ProjectCore } from "@/lib/db/repository";

/**
 * Lädt `ProjectCore` inkl. signierter Anhang-URLs für die Auftragsseite.
 * Zugriff wie in `app/(tech)/auftrag/[projectId]/page.tsx`.
 */
export async function fetchAuftragProjectCoreAction(projectId: string): Promise<ProjectCore> {
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

  const signedAttachments = await signAttachmentUrls(core.attachments);
  return { ...core, attachments: signedAttachments };
}
