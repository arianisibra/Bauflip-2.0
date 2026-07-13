"use server";

import { requireAdminLayoutSession, requireOfficeSession } from "@/lib/auth/organization";
import { getCachedSessionProfile } from "@/lib/auth/session";
import {
  createDocumentTemplate,
  deleteDocumentTemplate,
  listDocumentTemplates,
  setDefaultDocumentTemplate,
} from "@/lib/db/document-templates";
import { documentTemplateKinds, type DocumentTemplate, type DocumentTemplateKind } from "@/lib/domain/types";
import { findUnknownTemplateTags } from "@/lib/documents/render-docx";
import {
  QUOTE_DOCUMENT_TOKEN_KEYS,
  SAMPLE_QUOTE_DOCUMENT_DATA,
} from "@/lib/documents/quote-document-data";

const MAX_TEMPLATE_BYTES = 10 * 1024 * 1024;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function parseKind(value: unknown): DocumentTemplateKind {
  if (typeof value === "string" && (documentTemplateKinds as readonly string[]).includes(value)) {
    return value as DocumentTemplateKind;
  }
  return "offerte";
}

export async function listDocumentTemplatesAction(): Promise<DocumentTemplate[]> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) return [];
  return listDocumentTemplates(session.organizationId);
}

/** Für Büro/Admin: existiert überhaupt eine Offert-Vorlage? (steuert den «Als Word»-Eintrag) */
export async function hasOfferDocumentTemplateAction(): Promise<boolean> {
  const session = await requireOfficeSession();
  if (!session.organizationId) return false;
  const templates = await listDocumentTemplates(session.organizationId, "offerte");
  return templates.length > 0;
}

export async function uploadDocumentTemplateAction(formData: FormData): Promise<DocumentTemplate> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Bitte eine Word-Vorlage (.docx) wählen.");
  }
  if (file.size > MAX_TEMPLATE_BYTES) {
    throw new Error("Datei ist zu gross (max. 10 MB).");
  }
  const isDocx = file.type === DOCX_MIME || file.name.toLowerCase().endsWith(".docx");
  if (!isDocx) {
    throw new Error("Nur Word-Dateien (.docx) werden unterstützt.");
  }

  const name = String(formData.get("name") ?? "").trim() || file.name.replace(/\.docx$/i, "");
  const kind = parseKind(formData.get("kind"));
  const makeDefault = String(formData.get("makeDefault") ?? "") === "1";

  const bytes = Buffer.from(await file.arrayBuffer());

  // Vorlage prüfen: nutzt sie unbekannte Platzhalter, käme sonst ein still leeres
  // Dokument heraus. Lieber jetzt mit klarer Meldung ablehnen. (Aktuell nur «offerte».)
  if (kind === "offerte") {
    const unknownTags = findUnknownTemplateTags(
      bytes,
      QUOTE_DOCUMENT_TOKEN_KEYS,
      SAMPLE_QUOTE_DOCUMENT_DATA as unknown as Record<string, unknown>,
    );
    if (unknownTags.length > 0) {
      const shown = unknownTags.slice(0, 8).map((t) => `{${t}}`).join(", ");
      const rest = unknownTags.length > 8 ? ` … (+${unknownTags.length - 8})` : "";
      throw new Error(
        `Diese Vorlage nutzt unbekannte Platzhalter: ${shown}${rest}. ` +
          `Bitte nur die dokumentierten Bauflip-Felder verwenden (z. B. {offerte_nummer}, ` +
          `{kunde_name}, {#positionen}…{/positionen}). Sonst bleiben die Felder leer.`,
      );
    }
  }

  const profile = await getCachedSessionProfile(session);
  return createDocumentTemplate(session.organizationId, { kind, name, makeDefault }, bytes, profile.userId);
}

export async function setDefaultDocumentTemplateAction(input: {
  id: string;
  kind: DocumentTemplateKind;
}): Promise<void> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");
  await setDefaultDocumentTemplate(input.id, session.organizationId, input.kind);
}

export async function deleteDocumentTemplateAction(id: string): Promise<void> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");
  await deleteDocumentTemplate(id, session.organizationId);
}
