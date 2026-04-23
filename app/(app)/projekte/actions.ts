"use server";

import { getCurrentSession } from "@/lib/auth/session";
import {
  addAppointment,
  deleteProject,
  deleteAppointment,
  deleteTechnicianReport,
  getProjectCore,
  listAssignableProfiles,
  updateProject,
} from "@/lib/db/repository";
import type { ProjectCore } from "@/lib/db/repository";
import { listProjectsForOffice } from "@/lib/db/repository";
import type { OfficeProjectListItem, ProjectStatus, UserProfile } from "@/lib/domain/types";
import { projectStammdatenUpdateSchema, appointmentSchema } from "@/lib/validations/forms";

// Note: mutation actions used to call `revalidatePath("/projekte")` via
// `after()`. That's been removed — client cache is owned by TanStack Query,
// and `/projekte` is dynamically rendered, so there's no server-side cache
// entry to flush. Keeping revalidatePath would force a redundant RSC refetch.

async function coreOrThrow(projectId: string): Promise<ProjectCore> {
  const bundle = await getProjectCore(projectId);
  if (!bundle) throw new Error("Projekt nicht gefunden.");
  return bundle;
}

function nz(s: string | undefined | null): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

export async function getProjectSheetDataAction(projectId: string) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  const bundle = await getProjectCore(projectId);
  if (!bundle) {
    throw new Error("Projekt nicht gefunden.");
  }
  return { bundle };
}

export async function listProjectsForOfficeAction(): Promise<OfficeProjectListItem[]> {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  return listProjectsForOffice();
}

export async function listAssignableProfilesAction(): Promise<UserProfile[]> {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  return listAssignableProfiles();
}

export async function updateProjectStammdatenAction(values: unknown): Promise<{ core: ProjectCore }> {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }

  const parsed = projectStammdatenUpdateSchema.safeParse(values);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }

  const v = parsed.data;
  await updateProject(v.projectId, {
    title: v.title,
    status: v.status,
    intakeOriginalText: v.intakeOriginalText,
    tenantName: nz(v.tenantName),
    tenantPhone: nz(v.tenantPhone),
    tenantEmail: nz(v.tenantEmail),
    managementName: nz(v.managementName),
    managementPhone: nz(v.managementPhone),
    managementEmail: nz(v.managementEmail),
    costCeilingText: nz(v.costCeilingText),
    serviceStreet: nz(v.serviceStreet),
    servicePostalCode: nz(v.servicePostalCode),
    serviceCity: nz(v.serviceCity),
    serviceCountry: v.serviceCountry ?? undefined,
    hintsAndNotes: nz(v.hintsAndNotes),
    accessNotes: nz(v.accessNotes),
    nextOwnerUserId: v.nextOwnerUserId && v.nextOwnerUserId !== "" ? v.nextOwnerUserId : null,
  });

  const core = await coreOrThrow(v.projectId);
  return { core };
}

export async function addAppointmentAction(input: unknown): Promise<{ core: ProjectCore }> {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  const parsed = appointmentSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }
  const v = parsed.data;
  await addAppointment({
    projectId: v.projectId,
    kind: v.kind,
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    assignedTechnicianId: v.assignedTechnicianId ?? null,
    planningNotes: v.planningNotes ?? null,
  });
  const core = await coreOrThrow(v.projectId);
  return { core };
}

export async function deleteAppointmentAction(
  appointmentId: string,
  projectId: string,
): Promise<{ core: ProjectCore }> {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  await deleteAppointment(appointmentId);
  const core = await coreOrThrow(projectId);
  return { core };
}

export async function deleteProjectAction(projectId: string) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  if (!projectId) {
    throw new Error("Projekt-ID fehlt.");
  }
  await deleteProject(projectId);
}

export async function updateProjectStatusAction(
  projectId: string,
  status: ProjectStatus,
): Promise<{ core: ProjectCore }> {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  await updateProject(projectId, { status });
  const core = await coreOrThrow(projectId);
  return { core };
}

export async function deleteReportAction(
  reportId: string,
  projectId: string,
): Promise<{ core: ProjectCore }> {
  const session = await getCurrentSession();
  if (!session || session.role !== "admin") {
    throw new Error("Keine Berechtigung.");
  }
  await deleteTechnicianReport(reportId);
  const core = await coreOrThrow(projectId);
  return { core };
}
