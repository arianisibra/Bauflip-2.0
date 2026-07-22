import "server-only";

import { intakePdfExtractionSchema, type IntakePdfExtraction } from "@/lib/validations/forms";

/**
 * Liest eine Auftrags-PDF (E-Mail-Anhang oder aus einem Verwaltungsportal
 * heruntergeladen) direkt per Anthropic-Messages-API und extrahiert die
 * Intake-Felder als Vorbefüllung für «+ Neue Anfrage». Läuft serverseitig
 * im Hintergrund — der Kunde sieht davon nichts, kein eigener Claude-Zugang
 * nötig (analog SMTP für Mailversand: ein Server-seitiger API-Key).
 */

const EXTRACTION_TOOL_NAME = "submit_intake_fields";

const EXTRACTION_TOOL_SCHEMA = {
  type: "object",
  properties: {
    tenantName: { type: "string", description: "Name des Mieters/Ansprechpartners vor Ort" },
    tenantPhone: { type: "string", description: "Telefonnummer des Mieters/Ansprechpartners" },
    tenantEmail: { type: "string", description: "E-Mail des Mieters/Ansprechpartners" },
    managementName: { type: "string", description: "Name der Verwaltung/Firma, die den Auftrag erteilt" },
    managementPhone: { type: "string", description: "Telefonnummer der zuständigen Person bei der Verwaltung" },
    managementEmail: { type: "string", description: "E-Mail der zuständigen Person bei der Verwaltung" },
    costCeilingText: { type: "string", description: "Kostendach/Kostenlimite, falls im Dokument genannt (z. B. «CHF 500»)" },
    serviceStreet: { type: "string", description: "Strasse und Hausnummer des Einsatzorts" },
    servicePostalCode: { type: "string", description: "PLZ des Einsatzorts" },
    serviceCity: { type: "string", description: "Ort des Einsatzorts" },
    hintsAndNotes: {
      type: "string",
      description: "Kurze Zusammenfassung des Auftrags/Problems in eigenen Worten, für das Feld «Wichtige Informationen»",
    },
  },
  required: [],
} as const;

export function isPdfIntakeExtractionConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Extrahiert Intake-Felder aus einer Auftrags-PDF. Wirft bei fehlender Konfiguration oder API-Fehler. */
export async function extractIntakeFromPdf(pdfBase64: string): Promise<IntakePdfExtraction> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("PDF-Import ist nicht konfiguriert (ANTHROPIC_API_KEY in .env setzen).");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      tools: [
        {
          name: EXTRACTION_TOOL_NAME,
          description: "Übermittelt die aus der Auftrags-PDF erkannten Felder.",
          input_schema: EXTRACTION_TOOL_SCHEMA,
        },
      ],
      tool_choice: { type: "tool", name: EXTRACTION_TOOL_NAME },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
            },
            {
              type: "text",
              text:
                "Das ist ein eingehender Reparatur-/Wartungsauftrag (Storen/Beschattung) einer Immobilienverwaltung " +
                "oder eines Mieters. Extrahiere die verfügbaren Felder für die Auftragserfassung. Lasse ein Feld " +
                "weg, wenn es im Dokument nicht vorkommt — nichts erfinden.",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`PDF-Extraktion fehlgeschlagen (${response.status}). ${detail.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; name?: string; input?: unknown }>;
  };
  const toolUse = data.content?.find((block) => block.type === "tool_use" && block.name === EXTRACTION_TOOL_NAME);
  if (!toolUse) {
    throw new Error("PDF-Extraktion lieferte kein Ergebnis.");
  }

  const parsed = intakePdfExtractionSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error("PDF-Extraktion lieferte unerwartetes Format.");
  }
  return parsed.data;
}
