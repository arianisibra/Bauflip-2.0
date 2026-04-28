"use server";

import { getCurrentSession } from "@/lib/auth/session";
import {
  createProject,
  addProjectAttachment,
  getProjectCore,
  updateAttachmentNotes,
  deleteProjectAttachment,
  type ProjectCore,
} from "@/lib/db/repository";
import { intakeSchema } from "@/lib/validations/forms";
import { PROJECT_FILE_MAX_BYTES, PROJECT_FILE_MIME, sanitizeFileBaseName } from "@/lib/storage/mime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RoleType } from "@/lib/domain/types";
import { publish } from "@/lib/sse/hub";

function canManageProjectReportFiles(role: RoleType): boolean {
  return role === "office" || role === "admin" || role === "technician";
}

function ensureProjectAccessForReportFiles(
  session: { role: RoleType; user: { id: string }; organizationId: string | null },
  core: ProjectCore,
): { ok: true } | { ok: false; error: string } {
  if (session.role === "office" || session.role === "admin") {
    if (!session.organizationId || session.organizationId !== core.project.organizationId) {
      return { ok: false, error: "Keine Berechtigung." };
    }
    return { ok: true };
  }
  if (session.role === "technician") {
    const isAssigned =
      core.appointments.some((a) => a.assignedTechnicianId === session.user.id) ||
      core.project.nextOwnerUserId === session.user.id;
    if (!isAssigned) return { ok: false, error: "Keine Berechtigung." };
    if (!session.organizationId || session.organizationId !== core.project.organizationId) {
      return { ok: false, error: "Keine Berechtigung." };
    }
    return { ok: true };
  }
  return { ok: false, error: "Keine Berechtigung." };
}

function isAllowedProjectFileType(file: File): boolean {
  const rawType = (file.type || "").toLowerCase().trim();
  if (rawType === "image/jpg") {
    return true;
  }
  if (PROJECT_FILE_MIME.has(rawType)) {
    return true;
  }
  // Some mobile browsers provide an empty MIME type; fall back to extension.
  if (!rawType) {
    const lowerName = file.name.toLowerCase();
    return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif", ".pdf", ".doc", ".docx"].some((ext) =>
      lowerName.endsWith(ext),
    );
  }
  return false;
}

function deriveIntakeTitle(rawTenantName: string): string {
  const tenant = rawTenantName.trim();
  if (tenant.length >= 1) {
    return tenant;
  }
  throw new Error("Mieter / Kontakt fehlt.");
}

export async function createIntakeAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  if (!session.organizationId) {
    throw new Error("Keine Organisation.");
  }

  const raw = Object.fromEntries(formData.entries());
  const intakeOriginalText = String(raw.intakeOriginalText ?? "");
  const title = deriveIntakeTitle(String(raw.tenantName ?? ""));
  const parsed = intakeSchema.safeParse({
    title,
    source: raw.source ?? "email",
    type: raw.type ?? "reparatur",
    intakeOriginalText,
    tenantName: String(raw.tenantName ?? ""),
    tenantPhone: String(raw.tenantPhone ?? ""),
    tenantEmail: String(raw.tenantEmail ?? ""),
    managementName: String(raw.managementName ?? ""),
    managementPhone: String(raw.managementPhone ?? ""),
    managementEmail: String(raw.managementEmail ?? ""),
    costCeilingText: String(raw.costCeilingText ?? ""),
    serviceStreet: String(raw.serviceStreet ?? ""),
    servicePostalCode: String(raw.servicePostalCode ?? ""),
    serviceCity: String(raw.serviceCity ?? ""),
    hintsAndNotes: String(raw.hintsAndNotes ?? ""),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }

  const v = parsed.data;
  const project = await createProject({
    organizationId: session.organizationId,
    title: v.title,
    type: v.type,
    status: "offen",
    nextOwnerRole: "office",
    nextOwnerUserId: null,
    source: v.source,
    intakeOriginalText: v.intakeOriginalText,
    accessNotes: null,
    hintsAndNotes: v.hintsAndNotes?.trim() || null,
    tenantName: v.tenantName.trim(),
    tenantPhone: v.tenantPhone?.trim() || null,
    tenantEmail: v.tenantEmail?.trim() || null,
    managementName: v.managementName?.trim() || null,
    managementPhone: v.managementPhone?.trim() || null,
    managementEmail: v.managementEmail?.trim() || null,
    costCeilingText: v.costCeilingText?.trim() || null,
    serviceStreet: v.serviceStreet?.trim() || null,
    servicePostalCode: v.servicePostalCode?.trim() || null,
    serviceCity: v.serviceCity?.trim() || null,
    serviceCountry: "CH",
  });

  // Client-side cache invalidation is owned by TanStack via `useCreateIntake.onSuccess`.
  return { projectId: project.id };
}

export async function uploadProjectReportFileAction(
  formData: FormData,
  tabId?: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getCurrentSession();
  if (!session) return { success: false, error: "Nicht angemeldet." };
  if (!canManageProjectReportFiles(session.role)) {
    return { success: false, error: "Keine Berechtigung." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { success: false, error: "Supabase ist nicht konfiguriert." };

  const projectId = String(formData.get("projectId") ?? "").trim();
  const file = formData.get("file") as File | null;
  if (!projectId) return { success: false, error: "Projekt fehlt." };
  if (!file || typeof file !== "object" || file.size === 0) return { success: false, error: "Bitte eine Datei wählen." };
  if (!session.organizationId) return { success: false, error: "Keine Organisation." };
  if (!isAllowedProjectFileType(file)) return { success: false, error: "Dateityp nicht erlaubt." };
  if (file.size > PROJECT_FILE_MAX_BYTES) return { success: false, error: "Datei darf maximal 15 MB gross sein." };

  try {
    const [core, arrayBuf] = await Promise.all([getProjectCore(projectId), file.arrayBuffer()]);
    if (!core) return { success: false, error: "Projekt nicht gefunden." };
    const access = ensureProjectAccessForReportFiles(session, core);
    if (!access.ok) return { success: false, error: access.error };

    const safe = sanitizeFileBaseName(file.name) || "datei";
    const storagePath = `${session.organizationId}/${projectId}/reports/${Date.now()}-${safe}`;
    const buf = Buffer.from(arrayBuf);
    const { error: uploadError } = await supabase.storage.from("project-files").upload(storagePath, buf, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) return { success: false, error: uploadError.message };

    const notes = String(formData.get("notes") ?? "").trim() || null;
    await addProjectAttachment({
      projectId,
      filePath: storagePath,
      fileName: file.name,
      fileType: file.type,
      sizeBytes: file.size,
      uploadedBy: session.profile.id,
      notes,
    });
    if (session.organizationId) {
      publish(session.organizationId, {
        type: "project.core_changed",
        projectId,
        originTabId: tabId,
      });
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Upload fehlgeschlagen." };
  }

  // Client-side cache invalidation is owned by TanStack via `useUploadAttachment.onSuccess`.
  return { success: true };
}

export async function updateAttachmentNotesAction(
  attachmentId: string,
  notes: string,
  tabId?: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getCurrentSession();
  if (!session) return { success: false, error: "Nicht angemeldet." };
  if (!canManageProjectReportFiles(session.role)) {
    return { success: false, error: "Keine Berechtigung." };
  }
  if (!attachmentId) return { success: false, error: "Anhang-ID fehlt." };
  if (notes.length > 2000) return { success: false, error: "Notiz zu lang (max. 2000 Zeichen)." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { success: false, error: "Supabase ist nicht konfiguriert." };
  const { data: att } = await supabase
    .from("project_attachments")
    .select("project_id")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!att?.project_id) return { success: false, error: "Anhang nicht gefunden." };
  const core = await getProjectCore(String(att.project_id));
  if (!core) return { success: false, error: "Projekt nicht gefunden." };
  const access = ensureProjectAccessForReportFiles(session, core);
  if (!access.ok) return { success: false, error: access.error };
  try {
    await updateAttachmentNotes(attachmentId, notes);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Speichern fehlgeschlagen." };
  }
  const pid = String(att.project_id);
  if (session.organizationId) {
    publish(session.organizationId, {
      type: "project.core_changed",
      projectId: pid,
      originTabId: tabId,
    });
  }
  return { success: true };
}

export async function deleteAttachmentAction(
  attachmentId: string,
  filePath: string,
  tabId?: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getCurrentSession();
  if (!session) return { success: false, error: "Nicht angemeldet." };
  if (!canManageProjectReportFiles(session.role)) {
    return { success: false, error: "Keine Berechtigung." };
  }
  if (!attachmentId || !filePath) return { success: false, error: "Parameter fehlen." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { success: false, error: "Supabase ist nicht konfiguriert." };
  const { data: att } = await supabase
    .from("project_attachments")
    .select("project_id")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!att?.project_id) return { success: false, error: "Anhang nicht gefunden." };
  const core = await getProjectCore(String(att.project_id));
  if (!core) return { success: false, error: "Projekt nicht gefunden." };
  const access = ensureProjectAccessForReportFiles(session, core);
  if (!access.ok) return { success: false, error: access.error };
  try {
    await deleteProjectAttachment(attachmentId, filePath);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Löschen fehlgeschlagen." };
  }
  const pid = String(att.project_id);
  if (session.organizationId) {
    publish(session.organizationId, {
      type: "project.core_changed",
      projectId: pid,
      originTabId: tabId,
    });
  }
  // Client-side cache invalidation is owned by TanStack via `useDeleteAttachment.onSuccess`.
  return { success: true };
}
