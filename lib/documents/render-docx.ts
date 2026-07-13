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
    doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      // Fehlende/unbekannte Platzhalter leer rendern statt das Wort «undefined»
      // ins Dokument zu schreiben (z. B. wenn eine Vorlage ein optionales Feld nutzt).
      nullGetter: () => "",
    });
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

/**
 * Findet Platzhalter in einer Vorlage, die Bauflip **nicht** kennt.
 *
 * Vorgehen: die Vorlage mit vollständigen Beispieldaten (alle bekannten Felder
 * belegt) rendern. `nullGetter` wird dann nur noch für Tags aufgerufen, die es in
 * den Beispieldaten NICHT gibt — genau die unbekannten Platzhalter. So merkt ein
 * Kunde beim Hochladen sofort, wenn seine Vorlage falsche Feldnamen nutzt
 * (sonst käme still ein leeres Dokument heraus).
 *
 * `knownKeys` wird zusätzlich geprüft, damit ein bekannter Feldname, der im
 * Beispiel zufällig leer ist, nicht fälschlich als unbekannt gemeldet wird.
 */
export function findUnknownTemplateTags(
  templateBytes: Buffer | Uint8Array,
  knownKeys: readonly string[],
  sampleData: Record<string, unknown>,
): string[] {
  let zip: PizZip;
  try {
    zip = new PizZip(Buffer.from(templateBytes));
  } catch {
    throw new DocumentTemplateError("Vorlage ist keine gültige .docx-Datei.");
  }

  const known = new Set(knownKeys);
  const unknown = new Set<string>();
  try {
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: (part: { value?: string } = {}) => {
        const tag = part.value;
        if (tag && !known.has(tag)) unknown.add(tag);
        return "";
      },
    });
    doc.render(sampleData);
  } catch {
    // Strukturfehler (offene Schleife o. Ä.) sind hier zweitrangig — der eigentliche
    // Render meldet sie sauber. Für die Tag-Prüfung reicht, was bis dahin gesammelt wurde.
  }
  return [...unknown];
}
