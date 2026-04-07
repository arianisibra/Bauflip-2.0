"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { createProject, addProjectAttachment, getProjectCore, updateAttachmentNotes, deleteProjectAttachment } from "@/lib/db/repository";
import { intakeSchema } from "@/lib/validations/forms";
import { PROJECT_FILE_MAX_BYTES, PROJECT_FILE_MIME, sanitizeFileBaseName } from "@/lib/storage/mime";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function createIntakeAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  if (!session.organizationId) {
    throw new Error("Keine Organisation.");
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = intakeSchema.safeParse({
    title: String(raw.title ?? ""),
    source: raw.source ?? "email",
    type: raw.type ?? "reparatur",
    intakeOriginalText: String(raw.intakeOriginalText ?? ""),
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

  revalidatePath("/projekte");
  return { projectId: project.id };
}

export async function uploadProjectReportFileAction(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getCurrentSession();
  if (!session) return { success: false, error: "Nicht angemeldet." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { success: false, error: "Supabase ist nicht konfiguriert." };

  const projectId = String(formData.get("projectId") ?? "").trim();
  const file = formData.get("file") as File | null;
  if (!projectId) return { success: false, error: "Projekt fehlt." };
  if (!file || typeof file !== "object" || file.size === 0) return { success: false, error: "Bitte eine Datei wählen." };
  if (!session.organizationId) return { success: false, error: "Keine Organisation." };
  if (!PROJECT_FILE_MIME.has(file.type)) return { success: false, error: "Dateityp nicht erlaubt." };
  if (file.size > PROJECT_FILE_MAX_BYTES) return { success: false, error: "Datei darf maximal 15 MB gross sein." };

  const core = await getProjectCore(projectId);
  if (!core) return { success: false, error: "Projekt nicht gefunden." };

  try {
    const safe = sanitizeFileBaseName(file.name) || "datei";
    const storagePath = `${session.organizationId}/${projectId}/reports/${Date.now()}-${safe}`;
    const buf = Buffer.from(await file.arrayBuffer());
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
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Upload fehlgeschlagen." };
  }

  revalidatePath("/projekte");
  return { success: true };
}

export async function updateAttachmentNotesAction(
  attachmentId: string,
  notes: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getCurrentSession();
  if (!session) return { success: false, error: "Nicht angemeldet." };
  try {
    await updateAttachmentNotes(attachmentId, notes);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Speichern fehlgeschlagen." };
  }
  return { success: true };
}

export async function deleteAttachmentAction(
  attachmentId: string,
  filePath: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getCurrentSession();
  if (!session) return { success: false, error: "Nicht angemeldet." };
  try {
    await deleteProjectAttachment(attachmentId, filePath);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Löschen fehlgeschlagen." };
  }
  revalidatePath("/projekte");
  return { success: true };
}
