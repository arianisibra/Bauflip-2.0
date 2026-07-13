import "server-only";

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

/**
 * Füllt eine Word-Vorlage (.docx-Bytes) mit den Vorlagendaten und liefert das
 * gerenderte .docx zurück. Nutzt nur den freien docxtemplater-Kern (MIT):
 * Platzhalter `{feld}` + Schleifen `{#positionen}…{/positionen}`.
 *
 * Wichtig: KEIN angular-/JS-Parser aktiviert (kein Eval) — Vorlagen sind
 * Kundendaten. PDF-Ausgabe (optional) ist ein separater Konvertierungsschritt
 * (LibreOffice/Gotenberg) und nicht Teil dieser Funktion.
 */

export class DocumentTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentTemplateError";
  }
}

export function renderDocxTemplate(
  templateBytes: Buffer | Uint8Array,
  data: Record<string, unknown>,
): Buffer {
  let zip: PizZip;
  try {
    zip = new PizZip(Buffer.from(templateBytes));
  } catch {
    throw new DocumentTemplateError("Vorlage ist keine gültige .docx-Datei.");
  }

  let doc: Docxtemplater;
  try {
    doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(data);
  } catch (err) {
    // docxtemplater bündelt Template-Fehler (unbekannte Tags, offene Schleifen) —
    // in eine lesbare Meldung überführen statt den Rohfehler durchzureichen.
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "Vorlage konnte nicht gefüllt werden.";
    throw new DocumentTemplateError(message);
  }

  return doc.getZip().generate({ type: "nodebuffer" });
}
