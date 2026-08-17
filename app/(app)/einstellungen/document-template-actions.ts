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
import {
  AUFTRAG_DOCUMENT_TOKEN_KEYS,
  SAMPLE_AUFTRAG_DOCUMENT_DATA,
} from "@/lib/documents/auftrag-document-data";
import {
  RAPPORT_DOCUMENT_TOKEN_KEYS,
  SAMPLE_RAPPORT_DOCUMENT_DATA,
} from "@/lib/documents/rapport-document-data";
import {
  INVOICE_DOCUMENT_TOKEN_KEYS,
  SAMPLE_INVOICE_DOCUMENT_DATA,
} from "@/lib/documents/invoice-document-data";

/** Token-Katalog + Beispiel je Vorlagen-Art für die Upload-Prüfung (null = keine Prüfung). */
function templateTokenSpec(
  kind: DocumentTemplateKind,
): { tokens: readonly string[]; sample: Record<string, unknown>; beispiele: string } | null {
  if (kind === "offerte") {
    return {
      tokens: QUOTE_DOCUMENT_TOKEN_KEYS,
      sample: SAMPLE_QUOTE_DOCUMENT_DATA as unknown as Record<string, unknown>,
      beispiele: "{offerte_nummer}, {kunde_name}, {#positionen}…{/positionen}",
    };
  }
  if (kind === "auftrag") {
    return {
      tokens: AUFTRAG_DOCUMENT_TOKEN_KEYS,
      sample: SAMPLE_AUFTRAG_DOCUMENT_DATA as unknown as Record<string, unknown>,
      beispiele: "{auftrag_nummer}, {kunde_name}, {beschreibung}, {objekt}",
    };
  }
  if (kind === "rapport") {
    return {
      tokens: RAPPORT_DOCUMENT_TOKEN_KEYS,
      sample: SAMPLE_RAPPORT_DOCUMENT_DATA as unknown as Record<string, unknown>,
      beispiele: "{monteur}, {ergebnis}, {arbeitsbeschreibung}, {zeit}",
    };
  }
  if (kind === "rechnung") {
    return {
      tokens: INVOICE_DOCUMENT_TOKEN_KEYS,
      sample: SAMPLE_INVOICE_DOCUMENT_DATA as unknown as Record<string, unknown>,
      beispiele: "{rechnung_nummer}, {kunde_name}, {#positionen}…{/positionen}",
    };
  }
  return null;
}

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

/** Für Büro/Admin: existiert eine Auftragsvorlage? (steuert den «Als Word (Auftrag)»-Button) */
export async function hasAuftragDocumentTemplateAction(): Promise<boolean> {
  const session = await requireOfficeSession();
  if (!session.organizationId) return false;
  const templates = await listDocumentTemplates(session.organizationId, "auftrag");
  return templates.length > 0;
}

/** Für Büro/Admin: existiert eine Rapportvorlage? (steuert den «Als Word (Rapport)»-Button) */
export async function hasRapportDocumentTemplateAction(): Promise<boolean> {
  const session = await requireOfficeSession();
  if (!session.organizationId) return false;
  const templates = await listDocumentTemplates(session.organizationId, "rapport");
  return templates.length > 0;
}

/** Für Büro/Admin: existiert eine Rechnungsvorlage? (steuert den «Als Word (Rechnung)»-Button) */
export async function hasInvoiceDocumentTemplateAction(): Promise<boolean> {
  const session = await requireOfficeSession();
  if (!session.organizationId) return false;
  const templates = await listDocumentTemplates(session.organizationId, "rechnung");
  return templates.length > 0;
}

export type UploadDocumentTemplateResult =
  | { ok: true; template: DocumentTemplate }
  | { ok: false; error: string };

/**
 * Gibt Fehler als Wert zurück statt zu werfen: Next.js maskiert in Produktion jeden aus
 * einer Server Action geworfenen Fehler zu einer generischen Meldung (nur der Digest
 * erreicht den Client, der Klartext bleibt im Server-Log) — die Upload-Validierung
 * (unbekannte Platzhalter etc.) ist aber gezielt für den Nutzer gedacht.
 */
export async function uploadDocumentTemplateAction(formData: FormData): Promise<UploadDocumentTemplateResult> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) return { ok: false, error: "Keine Organisation." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Bitte eine Word-Vorlage (.docx) wählen." };
  }
  if (file.size > MAX_TEMPLATE_BYTES) {
    return { ok: false, error: "Datei ist zu gross (max. 10 MB)." };
  }
  const isDocx = file.type === DOCX_MIME || file.name.toLowerCase().endsWith(".docx");
  if (!isDocx) {
    return { ok: false, error: "Nur Word-Dateien (.docx) werden unterstützt." };
  }

  const name = String(formData.get("name") ?? "").trim() || file.name.replace(/\.docx$/i, "");
  const kind = parseKind(formData.get("kind"));
  const makeDefault = String(formData.get("makeDefault") ?? "") === "1";

  const bytes = Buffer.from(await file.arrayBuffer());

  // Vorlage prüfen: nutzt sie unbekannte Platzhalter, käme sonst ein still leeres
  // Dokument heraus. Lieber jetzt mit klarer Meldung ablehnen.
  const spec = templateTokenSpec(kind);
  if (spec) {
    const unknownTags = findUnknownTemplateTags(bytes, spec.tokens, spec.sample);
    if (unknownTags.length > 0) {
      const shown = unknownTags.slice(0, 8).map((t) => `{${t}}`).join(", ");
      const rest = unknownTags.length > 8 ? ` … (+${unknownTags.length - 8})` : "";
      return {
        ok: false,
        error:
          `Diese Vorlage nutzt unbekannte Platzhalter: ${shown}${rest}. ` +
          `Bitte nur die dokumentierten Bauflip-Felder verwenden (z. B. ${spec.beispiele}). ` +
          `Sonst bleiben die Felder leer.`,
      };
    }
  }

  const profile = await getCachedSessionProfile(session);
  try {
    const template = await createDocumentTemplate(
      session.organizationId,
      { kind, name, makeDefault },
      bytes,
      profile.userId,
    );
    return { ok: true, template };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Vorlage konnte nicht angelegt werden." };
  }
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
