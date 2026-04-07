"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import {
  addAppointment,
  deleteProject,
  deleteAppointment,
  deleteTechnicianReport,
  getProjectCore,
  updateProject,
} from "@/lib/db/repository";
import { projectStammdatenUpdateSchema } from "@/lib/validations/forms";

function nz(s: string | undefined | null): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

export async function getProjectSheetDataAction(projectId: string) {
  const bundle = await getProjectCore(projectId);
  if (!bundle) {
    throw new Error("Projekt nicht gefunden.");
  }
  return { bundle };
}

export async function updateProjectStammdatenAction(values: unknown) {
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

  revalidatePath("/projekte");
}

export async function addAppointmentAction(input: {
  projectId: string;
  kind: "besichtigung" | "ausfuehrung";
  startsAt: string;
  endsAt: string;
  assignedTechnicianId?: string | null;
}) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  await addAppointment({
    projectId: input.projectId,
    kind: input.kind,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    assignedTechnicianId: input.assignedTechnicianId ?? null,
    planningNotes: null,
  });
  revalidatePath("/projekte");
}

export async function deleteAppointmentAction(appointmentId: string) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  await deleteAppointment(appointmentId);
  revalidatePath("/projekte");
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
  revalidatePath("/projekte");
}

export async function deleteReportAction(reportId: string) {
  const session = await getCurrentSession();
  if (!session || session.role !== "admin") {
    throw new Error("Keine Berechtigung.");
  }
  await deleteTechnicianReport(reportId);
  revalidatePath("/projekte");
}
