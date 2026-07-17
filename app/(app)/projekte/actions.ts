"use server";

import {
  requireAdminLayoutSession,
  requireOfficeSession,
  requireTechFieldSession,
} from "@/lib/auth/organization";
import { getCachedSessionProfile } from "@/lib/auth/session";
import {
  addAppointment,
  archiveProject,
  restoreProject,
  deleteProject,
  deleteAppointment,
  reassignAppointmentTechnician,
  deleteTechnicianReport,
  getReportSignature,
  getOfficeProjectListItemById,
  getProjectCore,
  getProjectCoreDetails,
  getProjectCoreHead,
  listAssignableProfiles,
  listActiveOrderFormTemplatesForOrg,
  listProjectsForOfficePage,
  loadProjectCoreBootstrap,
  signAttachmentUrls,
  updateProject,
  updateTechnicianReport,
} from "@/lib/db/repository";
import type { ProjectCore, ProjectCoreDetails, ProjectCoreHead } from "@/lib/db/repository";
import type { ProjectStatus, UserProfile } from "@/lib/domain/types";
import { DEFAULT_PROJEKTE_LIST_FILTER, type ProjekteListFilter } from "@/lib/projekte/list-filter";
import { parseProjekteSearchQuery } from "@/lib/projekte/list-page";
import { loadProjekteBootstrapData } from "@/lib/projekte/server-bootstrap";
import {
  loadInviteAppointmentData,
  sendAppointmentInvites,
} from "@/lib/calendar-invite/send";
import { publish } from "@/lib/realtime/publish";
import {
  projectStammdatenUpdateSchema,
  appointmentSchema,
  garantiefallSchema,
  reassignAppointmentTechnicianSchema,
  technicianReportUpdateSchema,
} from "@/lib/validations/forms";
import { validateOrderFormValues } from "@/lib/order-forms/validate-submission";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withSlowLog } from "@/lib/observability/slow-log";

// Note: mutation actions used to call `revalidatePath("/projekte")` via
// `after()`. That's been removed — client cache is owned by TanStack Query,
// and `/projekte` is dynamically rendered, so there's no server-side cache
// entry to flush. Keeping revalidatePath would force a redundant RSC refetch.

async function coreOrThrow(projectId: string): Promise<ProjectCore> {
  const bundle = await getProjectCore(projectId);
  if (!bundle) throw new Error("Projekt nicht gefunden.");
  const signedAttachments = await withSlowLog("signAttachmentUrls", () => signAttachmentUrls(bundle.attachments), {
    attachmentCount: bundle.attachments.length,
  });
  return { ...bundle, attachments: signedAttachments };
}

function nz(s: string | undefined | null): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

export async function getProjectSheetBootstrapAction(
  projectId: string,
): Promise<{ core: ProjectCore }> {
  await requireOfficeSession();
  const bundle = await loadProjectCoreBootstrap(projectId);
  if (!bundle) {
    throw new Error("Projekt nicht gefunden.");
  }
  const signedAttachments = await withSlowLog("signAttachmentUrls", () => signAttachmentUrls(bundle.attachments), {
    attachmentCount: bundle.attachments.length,
  });
  return { core: { ...bundle, attachments: signedAttachments } };
}

export async function getProjectSheetHeadAction(projectId: string): Promise<{ head: ProjectCoreHead }> {
  await requireOfficeSession();
  const head = await getProjectCoreHead(projectId);
  if (!head) {
    throw new Error("Projekt nicht gefunden.");
  }
  return { head };
}

export async function getProjectSheetDetailsAction(
  projectId: string,
): Promise<{ details: ProjectCoreDetails }> {
  await requireOfficeSession();
  const details = await getProjectCoreDetails(projectId);
  if (!details) {
    throw new Error("Projekt nicht gefunden.");
  }
  const signedAttachments = await withSlowLog("signAttachmentUrls", () => signAttachmentUrls(details.attachments), {
    attachmentCount: details.attachments.length,
  });
  return { details: { ...details, attachments: signedAttachments } };
}

export async function listAssignableProfilesAction(): Promise<UserProfile[]> {
  const session = await requireOfficeSession();
  return listAssignableProfiles(session.organizationId);
}

export async function fetchProjekteBootstrapAction(
  listFilter: ProjekteListFilter = DEFAULT_PROJEKTE_LIST_FILTER,
  searchQueryRaw?: string | null,
): Promise<Awaited<ReturnType<typeof loadProjekteBootstrapData>>> {
  const session = await requireOfficeSession();
  if (!session.organizationId) {
    throw new Error("Keine Organisation.");
  }
  return loadProjekteBootstrapData(session.organizationId, listFilter, searchQueryRaw);
}

export async function fetchProjekteListPageAction(input: {
  listFilter?: ProjekteListFilter;
  searchQuery?: string | null;
  cursor: string;
}): Promise<Awaited<ReturnType<typeof listProjectsForOfficePage>>> {
  const session = await requireOfficeSession();
  if (!session.organizationId) {
    throw new Error("Keine Organisation.");
  }
  const listFilter = input.listFilter ?? DEFAULT_PROJEKTE_LIST_FILTER;
  const searchQuery = parseProjekteSearchQuery(input.searchQuery);
  return listProjectsForOfficePage(session.organizationId, listFilter, {
    cursor: input.cursor,
    searchQuery,
  });
}

export async function fetchOfficeProjectListItemAction(projectId: string) {
  const session = await requireOfficeSession();
  if (!session.organizationId) {
    throw new Error("Keine Organisation.");
  }
  const item = await getOfficeProjectListItemById(session.organizationId, projectId);
  if (!item) {
    throw new Error("Projekt nicht gefunden.");
  }
  return item;
}

export async function updateProjectStammdatenAction(
  values: unknown,
  tabId?: string,
): Promise<{ core: ProjectCore }> {
  const session = await requireOfficeSession();

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
    statusUpdateSource: v.status !== undefined ? "manual" : undefined,
  });

  const core = await coreOrThrow(v.projectId);
  if (session.organizationId) {
    await publish(session.organizationId, {
      type: "project.core_changed",
      projectId: v.projectId,
      originTabId: tabId,
    });
  }
  return { core };
}

export async function addAppointmentAction(
  input: unknown,
  tabId?: string,
): Promise<{ core: ProjectCore }> {
  const session = await requireOfficeSession();
  const parsed = appointmentSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }
  const v = parsed.data;
  const created = await addAppointment({
    projectId: v.projectId,
    kind: v.kind,
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    assignedTechnicianId: v.assignedTechnicianId,
    assignedTechnicianId2: v.assignedTechnicianId2?.trim() || null,
    planningNotes: v.planningNotes ?? null,
  });
  await sendAppointmentInvites(
    "REQUEST",
    {
      appointmentId: created.id,
      projectId: v.projectId,
      kind: v.kind,
      startsAtIso: created.startsAt,
      endsAtIso: created.endsAt,
      planningNotes: created.planningNotes,
    },
    [created.assignedTechnicianId, created.assignedTechnicianId2],
  );
  const core = await coreOrThrow(v.projectId);
  if (session.organizationId) {
    await publish(session.organizationId, {
      type: "appointment.changed",
      projectId: v.projectId,
      originTabId: tabId,
    });
  }
  return { core };
}

export async function reassignAppointmentTechnicianAction(
  input: unknown,
  tabId?: string,
): Promise<{ core: ProjectCore }> {
  const session = await requireOfficeSession();
  const parsed = reassignAppointmentTechnicianSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }
  const v = parsed.data;
  if (v.assignedTechnicianId) {
    const assignable = await listAssignableProfiles(session.organizationId);
    if (!assignable.some((p) => p.id === v.assignedTechnicianId)) {
      throw new Error("Die gewählte Person ist in dieser Organisation nicht zuweisbar.");
    }
    const bundle = await getProjectCore(v.projectId);
    const appt = bundle?.appointments.find((a) => a.id === v.appointmentId);
    const otherSlotId = v.slot === 2 ? appt?.assignedTechnicianId : appt?.assignedTechnicianId2;
    if (otherSlotId && otherSlotId === v.assignedTechnicianId) {
      throw new Error("Diese Person ist bereits als andere zuständige Person an diesem Termin zugewiesen.");
    }
  }
  // Vorherige Zuweisung für Einladungs-Absage festhalten.
  const before = await loadInviteAppointmentData(v.appointmentId);
  await reassignAppointmentTechnician(v.appointmentId, v.projectId, v.assignedTechnicianId, v.slot);
  if (before) {
    const previousId = v.slot === 2 ? before.assignedTechnicianId2 : before.assignedTechnicianId;
    if (previousId && previousId !== v.assignedTechnicianId) {
      await sendAppointmentInvites("CANCEL", before, [previousId]);
    }
    if (v.assignedTechnicianId && v.assignedTechnicianId !== previousId) {
      await sendAppointmentInvites("REQUEST", before, [v.assignedTechnicianId]);
    }
  }
  const core = await coreOrThrow(v.projectId);
  if (session.organizationId) {
    await publish(session.organizationId, {
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
  const session = await requireOfficeSession();
  // Termindaten vor der Löschung sichern — für die Kalender-Absage.
  const before = await loadInviteAppointmentData(appointmentId);
  await deleteAppointment(appointmentId);
  if (before) {
    await sendAppointmentInvites("CANCEL", before, [
      before.assignedTechnicianId,
      before.assignedTechnicianId2,
    ]);
  }
  const core = await coreOrThrow(projectId);
  if (session.organizationId) {
    await publish(session.organizationId, {
      type: "appointment.changed",
      projectId,
      originTabId: tabId,
    });
  }
  return { core };
}

/** Projekt archivieren (Soft): raus aus der aktiven Liste, wiederherstellbar. Büro+Admin. */
export async function archiveProjectAction(projectId: string, tabId?: string) {
  const session = await requireOfficeSession();
  if (!projectId) {
    throw new Error("Projekt-ID fehlt.");
  }
  await archiveProject(projectId, session.userId ?? null);
  if (session.organizationId) {
    await publish(session.organizationId, {
      type: "project.archived",
      projectId,
      originTabId: tabId,
    });
  }
}

/** Archiviertes Projekt wiederherstellen (zurück in die aktive Liste). Büro+Admin. */
export async function restoreProjectAction(projectId: string, tabId?: string) {
  const session = await requireOfficeSession();
  if (!projectId) {
    throw new Error("Projekt-ID fehlt.");
  }
  await restoreProject(projectId);
  if (session.organizationId) {
    await publish(session.organizationId, {
      type: "project.restored",
      projectId,
      originTabId: tabId,
    });
  }
}

/** Endgültiges Löschen (Hard-Delete, Kaskade, unwiderruflich). Nur Admin. */
export async function deleteProjectPermanentlyAction(projectId: string, tabId?: string) {
  const session = await requireAdminLayoutSession();
  if (!projectId) {
    throw new Error("Projekt-ID fehlt.");
  }
  await deleteProject(projectId);
  if (session.organizationId) {
    await publish(session.organizationId, {
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
  const session = await requireOfficeSession();
  await updateProject(projectId, { status, statusUpdateSource: "manual" });
  const core = await coreOrThrow(projectId);
  if (session.organizationId) {
    await publish(session.organizationId, {
      type: "project.core_changed",
      projectId,
      originTabId: tabId,
    });
  }
  return { core };
}

export async function setGarantiefallAction(
  projectId: string,
  note: string,
  tabId?: string,
): Promise<{ core: ProjectCore }> {
  const session = await requireOfficeSession();
  const parsed = garantiefallSchema.safeParse({ projectId, note });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }
  const profile = await getCachedSessionProfile(session);
  await updateProject(projectId, {
    status: "garantiefall",
    statusUpdateSource: "manual",
    warrantyNote: parsed.data.note,
    warrantyOpenedAt: new Date().toISOString(),
    warrantyOpenedByUserId: profile.userId,
    warrantyOpenedByDisplayName: profile.displayName,
  });
  const core = await coreOrThrow(projectId);
  if (session.organizationId) {
    await publish(session.organizationId, {
      type: "project.core_changed",
      projectId,
      originTabId: tabId,
    });
  }
  return { core };
}

/** Kundensignatur on-demand (Rapport-Karte aufgeklappt) — nicht in Listen-Payloads. */
export async function getReportSignatureAction(
  reportId: string,
): Promise<{ signatureDataUrl: string | null; signedByName: string | null }> {
  await requireOfficeSession();
  const signature = await getReportSignature(reportId);
  if (!signature) throw new Error("Rapport nicht gefunden.");
  return signature;
}

export async function deleteReportAction(
  reportId: string,
  projectId: string,
): Promise<{ core: ProjectCore }> {
  await requireAdminLayoutSession();
  await deleteTechnicianReport(reportId);
  const core = await coreOrThrow(projectId);
  return { core };
}

export async function updateTechnicianReportAction(
  values: unknown,
  tabId?: string,
): Promise<{ core: ProjectCore }> {
  const session = await requireTechFieldSession();
  const isOffice = session.role === "office" || session.role === "admin";
  const isTechnician = session.role === "technician";

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
    if (!author || author !== session.userId) {
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
      const validated = validateOrderFormValues(tpl.id, tpl.fields, rawValues, {
        allFieldsVisible: true,
      });
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
    timeSpentMinutes: v.timeSpentMinutes,
    orderFormSubmissions: v.orderForms !== undefined ? orderFormSubmissions : undefined,
  });

  const core = await coreOrThrow(v.projectId);
  await publish(organizationId, {
    type: "project.core_changed",
    projectId: v.projectId,
    originTabId: tabId,
  });
  return { core };
}
