import "server-only";

import type { DocumentTemplate, DocumentTemplateKind } from "@/lib/domain/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "document-templates";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const COLS = "id, organization_id, kind, name, storage_path, output_format, is_default, created_by, created_at, updated_at";

function mapRow(row: Record<string, unknown>): DocumentTemplate {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    kind: row.kind as DocumentTemplateKind,
    name: String(row.name),
    storagePath: String(row.storage_path),
    outputFormat: (row.output_format as "docx" | "pdf") ?? "docx",
    isDefault: Boolean(row.is_default),
    createdByProfileId: row.created_by != null ? String(row.created_by) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listDocumentTemplates(
  organizationId: string,
  kind?: DocumentTemplateKind,
): Promise<DocumentTemplate[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  let query = supabase
    .from("document_templates")
    .select(COLS)
    .eq("organization_id", organizationId);
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query.order("kind").order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function getDefaultDocumentTemplate(
  organizationId: string,
  kind: DocumentTemplateKind,
): Promise<DocumentTemplate | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("document_templates")
    .select(COLS)
    .eq("organization_id", organizationId)
    .eq("kind", kind)
    .eq("is_default", true)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function getDocumentTemplateById(id: string): Promise<DocumentTemplate | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("document_templates").select(COLS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

/** Lädt die .docx-Bytes einer Vorlage aus dem Storage. */
export async function downloadTemplateBytes(storagePath: string): Promise<Buffer | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/** Setzt genau eine Standard-Vorlage je (Org, Typ) — erst andere zurücksetzen (Unique-Index). */
async function clearDefault(organizationId: string, kind: DocumentTemplateKind): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  await supabase
    .from("document_templates")
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("kind", kind)
    .eq("is_default", true);
}

export async function createDocumentTemplate(
  organizationId: string,
  input: { kind: DocumentTemplateKind; name: string; makeDefault: boolean },
  fileBytes: Buffer,
  createdByProfileId: string | null,
): Promise<DocumentTemplate> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const id = crypto.randomUUID();
  const storagePath = `${organizationId}/${id}.docx`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBytes, { contentType: DOCX_MIME, upsert: true });
  if (uploadError) throw new Error(`Vorlage konnte nicht gespeichert werden: ${uploadError.message}`);

  if (input.makeDefault) await clearDefault(organizationId, input.kind);

  const { data, error } = await supabase
    .from("document_templates")
    .insert({
      id,
      organization_id: organizationId,
      kind: input.kind,
      name: input.name,
      storage_path: storagePath,
      output_format: "docx",
      is_default: input.makeDefault,
      created_by: createdByProfileId,
    })
    .select(COLS)
    .single();
  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    throw new Error(error?.message ?? "Vorlage konnte nicht angelegt werden.");
  }
  return mapRow(data as Record<string, unknown>);
}

export async function setDefaultDocumentTemplate(
  id: string,
  organizationId: string,
  kind: DocumentTemplateKind,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");
  await clearDefault(organizationId, kind);
  const { error } = await supabase
    .from("document_templates")
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
}

export async function deleteDocumentTemplate(id: string, organizationId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");
  const { data } = await supabase
    .from("document_templates")
    .select("storage_path")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  const storagePath = data?.storage_path as string | undefined;
  const { error } = await supabase
    .from("document_templates")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  if (storagePath) await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
}
