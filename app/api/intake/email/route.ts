import { createProject } from "@/lib/db/repository";
import { getOrganizationIdByIntakeEmailToken } from "@/lib/db/intake-email";
import { extractIntakeFromPdf } from "@/lib/intake/extract-intake-pdf";
import { extractIntakeFromText } from "@/lib/intake/extract-intake-text";
import type { IntakePdfExtraction } from "@/lib/validations/forms";
import { postmarkInboundSchema } from "@/lib/validations/forms";
import { publish } from "@/lib/realtime/publish";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Inbound-E-Mail-Intake: Postmark (oder ein Provider mit kompatiblem Inbound-
 * JSON) postet hierher, sobald eine E-Mail an intake+<token>@<INTAKE_EMAIL_DOMAIN>
 * ankommt. Der Token in der Empfänger-Adresse identifiziert die Org UND dient
 * als Auth — kein Login, keine Session (Server-zu-Server-Webhook).
 */

function extractToken(recipient: string): string | null {
  const local = recipient.split("@")[0] ?? "";
  const plusIndex = local.indexOf("+");
  if (plusIndex === -1) return null;
  const token = local.slice(plusIndex + 1).trim();
  return token || null;
}

function deriveTitle(tenantName: string, fromName: string, subject: string): string {
  const name = tenantName.trim() || fromName.trim();
  if (name) return name;
  return subject.trim() || "NEUER AUFTRAG";
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Ungültiges JSON.", { status: 400 });
  }

  const parsed = postmarkInboundSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("Ungültiges Payload-Format.", { status: 400 });
  }
  const mail = parsed.data;

  const recipient = mail.OriginalRecipient || mail.To || "";
  const token = extractToken(recipient);
  if (!token) {
    return new Response("Keine Intake-Adresse erkannt.", { status: 404 });
  }

  const organizationId = await getOrganizationIdByIntakeEmailToken(token);
  if (!organizationId) {
    return new Response("Unbekannte Intake-Adresse.", { status: 404 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return new Response("E-Mail-Intake nicht verfügbar (Service-Role fehlt).", { status: 500 });
  }

  const subject = mail.Subject ?? "";
  const bodyText = (mail.StrippedTextReply || mail.TextBody || "").trim();
  const fromAddress = (mail.From ?? "").trim();
  const fromName = (mail.FromName ?? "").trim();
  const combinedText = [subject && `Betreff: ${subject}`, bodyText].filter(Boolean).join("\n\n");

  let extraction: IntakePdfExtraction = {};
  const pdfAttachment = mail.Attachments?.find((a) => (a.ContentType ?? "").toLowerCase() === "application/pdf");
  try {
    if (pdfAttachment?.Content) {
      extraction = await extractIntakeFromPdf(pdfAttachment.Content);
    } else if (bodyText && process.env.ANTHROPIC_API_KEY) {
      extraction = await extractIntakeFromText(combinedText || bodyText);
    }
  } catch {
    // KI-Extraktion ist ein Komfort-Feature — bei Fehlern läuft die Erfassung
    // mit den Rohdaten weiter (Büro sieht intakeOriginalText und ergänzt selbst).
  }

  try {
    const project = await createProject({
      organizationId,
      title: deriveTitle(extraction.tenantName ?? "", fromName, subject),
      type: "reparatur",
      status: "offen",
      nextOwnerRole: "office",
      nextOwnerUserId: null,
      source: "email",
      intakeOriginalText: combinedText || "(kein Text)",
      accessNotes: null,
      hintsAndNotes: extraction.hintsAndNotes?.trim() || null,
      tenantName: extraction.tenantName?.trim() || fromName || "",
      tenantPhone: extraction.tenantPhone?.trim() || null,
      tenantEmail: extraction.tenantEmail?.trim() || fromAddress || null,
      managementName: extraction.managementName?.trim() || null,
      managementPhone: extraction.managementPhone?.trim() || null,
      managementEmail: extraction.managementEmail?.trim() || null,
      costCeilingText: extraction.costCeilingText?.trim() || null,
      projectManagerName: null,
      customerNumber: null,
      serviceStreet: extraction.serviceStreet?.trim() || null,
      servicePostalCode: extraction.servicePostalCode?.trim() || null,
      serviceCity: extraction.serviceCity?.trim() || null,
      serviceCountry: "CH",
    }, admin);

    await publish(organizationId, { type: "project.core_changed", projectId: project.id });

    return Response.json({ projectId: project.id }, { status: 200 });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Anlegen fehlgeschlagen.", { status: 500 });
  }
}
