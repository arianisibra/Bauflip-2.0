import "server-only";

import { intakePdfExtractionSchema, type IntakePdfExtraction } from "@/lib/validations/forms";
import { EXTRACTION_TOOL_NAME, EXTRACTION_TOOL_SCHEMA } from "@/lib/intake/extract-intake-pdf";

/**
 * Wie extractIntakeFromPdf, aber für reinen E-Mail-Text (Intake-Webhook ohne
 * PDF-Anhang) — gleiches Extraktions-Tool/Schema, nur `document`- statt
 * `text`-Content-Block.
 */
export async function extractIntakeFromText(emailText: string): Promise<IntakePdfExtraction> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("E-Mail-Intake-Extraktion ist nicht konfiguriert (ANTHROPIC_API_KEY in .env setzen).");
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
          description: "Übermittelt die aus der E-Mail erkannten Felder.",
          input_schema: EXTRACTION_TOOL_SCHEMA,
        },
      ],
      tool_choice: { type: "tool", name: EXTRACTION_TOOL_NAME },
      messages: [
        {
          role: "user",
          content:
            "Das ist eine eingehende E-Mail mit einem Reparatur-/Wartungsauftrag (Storen/Beschattung) einer " +
            "Immobilienverwaltung oder eines Mieters. Extrahiere die verfügbaren Felder für die Auftragserfassung. " +
            "Lasse ein Feld weg, wenn es im Text nicht vorkommt — nichts erfinden.\n\n---\n\n" +
            emailText.slice(0, 20_000),
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`E-Mail-Extraktion fehlgeschlagen (${response.status}). ${detail.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; name?: string; input?: unknown }>;
  };
  const toolUse = data.content?.find((block) => block.type === "tool_use" && block.name === EXTRACTION_TOOL_NAME);
  if (!toolUse) {
    throw new Error("E-Mail-Extraktion lieferte kein Ergebnis.");
  }

  const parsed = intakePdfExtractionSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error("E-Mail-Extraktion lieferte unerwartetes Format.");
  }
  return parsed.data;
}
