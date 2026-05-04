"use server";

import { getCurrentSession } from "@/lib/auth/session";
import {
  addAppointment,
  deleteProject,
  deleteAppointment,
  deleteTechnicianReport,
  getProjectCore,
  listAssignableProfiles,
  listActiveOrderFormTemplatesForOrg,
  updateProject,
  updateTechnicianReport,
} from "@/lib/db/repository";
import type { ProjectCore } from "@/lib/db/repository";
import { listProjectsForOffice } from "@/lib/db/repository";
import type { OfficeProjectListItem, ProjectStatus, UserProfile } from "@/lib/domain/types";
import { publish } from "@/lib/sse/hub";
import { projectStammdatenUpdateSchema, appointmentSchema, technicianReportUpdateSchema } from "@/lib/validations/forms";
import { validateOrderFormValues } from "@/lib/order-forms/validate-submission";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const syncedTitle = String(v.tenantName ?? "").trim();
  await updateProject(v.projectId, {
    title: syncedTitle || undefined,
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

export async function addAppointmentAction(
  input: unknown,
  tabId?: string,
): Promise<{ core: ProjectCore }> {
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
  if (session.organizationId) {
    publish(session.organizationId, {
      type: "appointment.changed",
      projectId: v.projectId,
      originTabId: tabId,
    });
  }
  return { core };
}

export async function deleteAppointmentAction(
  appointmentId: string,
  projectId: string,
  tabId?: string,
): Promise<{ core: ProjectCore }> {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  await deleteAppointment(appointmentId);
  const core = await coreOrThrow(projectId);
  if (session.organizationId) {
    publish(session.organizationId, {
      type: "appointment.changed",
      projectId,
      originTabId: tabId,
    });
  }
  return { core };
}

export async function deleteProjectAction(projectId: string, tabId?: string) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  if (!projectId) {
    throw new Error("Projekt-ID fehlt.");
  }
  await deleteProject(projectId);
  if (session.organizationId) {
    publish(session.organizationId, {
      type: "project.deleted",
      projectId,
      originTabId: tabId,
    });
  }
}

export async function updateProjectStatusAction(
  projectId: string,
  status: ProjectStatus,
  tabId?: string,
): Promise<{ core: ProjectCore }> {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  await updateProject(projectId, { status });
  const core = await coreOrThrow(projectId);
  if (session.organizationId) {
    publish(session.organizationId, {
      type: "project.core_changed",
      projectId,
      originTabId: tabId,
    });
  }
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

export async function updateTechnicianReportAction(
  values: unknown,
  tabId?: string,
): Promise<{ core: ProjectCore }> {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Keine Berechtigung.");
  }
  const isOffice = session.role === "office" || session.role === "admin";
  const isTechnician = session.role === "technician";
  if (!isOffice && !isTechnician) {
    throw new Error("Keine Berechtigung.");
  }

  const parsed = technicianReportUpdateSchema.safeParse(values);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }
  const v = parsed.data;

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase nicht konfiguriert.");
  }

  if (isTechnician) {
    const { data: rep, error: repErr } = await supabase
      .from("technician_reports")
      .select("created_by")
      .eq("id", v.reportId)
      .eq("project_id", v.projectId)
      .maybeSingle();
    if (repErr) {
      throw new Error(repErr.message);
    }
    const author = (rep as { created_by?: string | null } | null)?.created_by;
    if (!author || author !== session.user.id) {
      throw new Error("Sie können nur eigene Rapporte bearbeiten.");
    }
  }

  const { data: proj, error: projErr } = await supabase
    .from("projects")
    .select("organization_id")
    .eq("id", v.projectId)
    .maybeSingle();

  if (projErr || !proj?.organization_id) {
    throw new Error("Projekt nicht gefunden.");
  }

  const organizationId = String(proj.organization_id);
  const activeTemplates = await listActiveOrderFormTemplatesForOrg(organizationId);
  const templateById = new Map(activeTemplates.map((t) => [t.id, t]));

  const orderFormSubmissions: { templateId: string; valuesJson: Record<string, string> }[] = [];

  for (const entry of v.orderForms ?? []) {
    const tpl = templateById.get(entry.templateId);
    if (!tpl) {
      throw new Error("Unbekannte oder inaktive Bestellformular-Vorlage.");
    }
    const rawValues = entry.values ?? {};
    try {
      const validated = validateOrderFormValues(tpl.id, tpl.fields, rawValues);
      if (Object.keys(validated).length > 0) {
        orderFormSubmissions.push({ templateId: tpl.id, valuesJson: validated });
      } else if (tpl.fields.some((f) => f.required)) {
        throw new Error(`Bestellformular „${tpl.name}“ ist unvollständig.`);
      }
    } catch (validationErr) {
      throw new Error(validationErr instanceof Error ? validationErr.message : "Validierung fehlgeschlagen.");
    }
  }

  await updateTechnicianReport(v.reportId, {
    projectId: v.projectId,
    outcome: v.outcome,
    summary: v.summary?.trim() ?? "",
    measurementsJson: (v.measurementsJson?.trim() || "{}") as string,
    workDescription: v.workDescription?.trim() ?? "",
    orderFormSubmissions: v.orderForms !== undefined ? orderFormSubmissions : undefined,
  });

  const core = await coreOrThrow(v.projectId);
  publish(organizationId, {
    type: "project.core_changed",
    projectId: v.projectId,
    originTabId: tabId,
  });
  return { core };
}
