"use server";

import { assertAuftragProjectAccess } from "@/lib/auth/auftrag-access";
import { getLayoutSession } from "@/lib/auth/session";
import type { ProjectCore } from "@/lib/db/repository";
import {
  getProjectCoreDetails,
  getProjectCoreHead,
  listActiveOrderFormTemplatesForOrg,
  listProjectAttachmentsForProject,
  signAttachmentUrls,
} from "@/lib/db/repository";
import type { ProjectAttachment, OrderFormTemplate } from "@/lib/domain/types";

export type AuftragExtras = {
  signedAttachments: ProjectAttachment[];
  orderFormTemplates: OrderFormTemplate[];
};

async function assertAuftragAccess(projectId: string): Promise<ProjectCore> {
  const session = await getLayoutSession();
  if (!session) {
    throw new Error("Nicht angemeldet.");
  }
  const trimmed = projectId.trim();
  if (!trimmed) {
    throw new Error("Projekt-ID fehlt.");
  }

  const head = await getProjectCoreHead(trimmed);
  if (!head) {
    throw new Error("Projekt nicht gefunden.");
  }
  assertAuftragProjectAccess(session, head);

  const details = await getProjectCoreDetails(trimmed);
  if (!details) {
    throw new Error("Projekt nicht gefunden.");
  }

  return { ...head, ...details };
}

/**
 * Signierte Anhang-URLs und Bestellformular-Templates für die Auftragsseite.
 * Läuft nach dem Document-Request, damit TTFB nicht auf Storage/Template-Queries wartet.
 */
export async function fetchAuftragExtrasAction(
  projectId: string,
  skipOrderFormTemplates = false,
): Promise<AuftragExtras> {
  const session = await getLayoutSession();
  if (!session) {
    throw new Error("Nicht angemeldet.");
  }
  const trimmed = projectId.trim();
  if (!trimmed) {
    throw new Error("Projekt-ID fehlt.");
  }

  const head = await getProjectCoreHead(trimmed);
  if (!head) {
    throw new Error("Projekt nicht gefunden.");
  }
  assertAuftragProjectAccess(session, head);

  const attachments = await listProjectAttachmentsForProject(trimmed);
  const [signedAttachments, orderFormTemplates] = await Promise.all([
    signAttachmentUrls(attachments),
    !skipOrderFormTemplates && head.project.organizationId != null
      ? listActiveOrderFormTemplatesForOrg(head.project.organizationId)
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
