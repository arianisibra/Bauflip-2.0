import "server-only";

import type { LayoutSession } from "@/lib/auth/session";
import type { ProjectCoreHead } from "@/lib/db/repository";

export function canAccessAuftragProject(
  session: Pick<LayoutSession, "userId" | "role" | "organizationId">,
  head: ProjectCoreHead,
): boolean {
  if (session.role === "technician") {
    return (
      head.appointments.some((a) => a.assignedTechnicianId === session.userId) ||
      head.project.nextOwnerUserId === session.userId
    );
  }
  if (session.role === "admin" || session.role === "office") {
    const orgId = head.project.organizationId;
    return Boolean(session.organizationId && orgId && session.organizationId === orgId);
  }
  return false;
}

export function assertAuftragProjectAccess(session: LayoutSession, head: ProjectCoreHead): void {
  if (!canAccessAuftragProject(session, head)) {
    throw new Error("Keine Berechtigung.");
  }
}
