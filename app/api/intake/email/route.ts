import { timingSafeEqual } from "node:crypto";
import { createProject } from "@/lib/db/repository";
import { getTrustedClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import {
  claimIntakeEmailMessage,
  getOrganizationIdByIntakeEmailToken,
  recordIntakeEmailProject,
  releaseIntakeEmailClaim,
} from "@/lib/db/intake-email";
import { extractIntakeFromPdf } from "@/lib/intake/extract-intake-pdf";
import { extractIntakeFromText } from "@/lib/intake/extract-intake-text";
import type { IntakePdfExtraction } from "@/lib/validations/forms";
import { postmarkInboundSchema } from "@/lib/validations/forms";
import { publish } from "@/lib/realtime/publish";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Inbound-E-Mail-Intake: Postmark (oder ein Provider mit kompatiblem Inbound-
 * JSON) postet hierher, sobald eine E-Mail an intake+<token>@<INTAKE_EMAIL_DOMAIN>
 * ankommt. Der Token in der Empfänger-Adresse benennt die Organisation.
 *
 * WICHTIG: Der Token allein ist KEINE Authentisierung. Er steht in der
 * Empfänger-Adresse, die jede Verwaltung und jeder Mieter kennt, und er wird
 * im JSON vom Aufrufer selbst gesetzt. Wer ihn kennt, könnte sonst beliebig
 * viele Fake-Aufträge in einen fremden Mandanten schreiben.
 *
 * Deshalb verlangt der Endpunkt zusätzlich ein gemeinsames Geheimnis
 * (INTAKE_WEBHOOK_SECRET) als Basic-Auth-Passwort. Beim Provider trägt man die
 * URL entsprechend ein:  https://intake:<secret>@app.example.ch/api/intake/email
 * Ohne gesetztes Secret nimmt der Endpunkt bewusst NICHTS an — lieber ein
 * stiller Ausfall des Komfort-Features als ein offenes Schreibtor.
 */

const MAX_PAYLOAD_BYTES = 15 * 1024 * 1024;

/** Zeitkonstanter Vergleich — verhindert, dass sich das Secret erraten lässt. */
function secretsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Basic-Auth-Passwort aus dem Authorization-Header lesen. */
function readBasicAuthPassword(header: string | null): string | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    return separator === -1 ? null : decoded.slice(separator + 1);
  } catch {
    return null;
  }
}

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
  // 1. Absender authentisieren — VOR dem Lesen des Payloads, damit ein
  //    Unbefugter nicht einmal Speicher belegen kann.
  const secret = process.env.INTAKE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[bauflip] INTAKE_WEBHOOK_SECRET fehlt — E-Mail-Intake ist deaktiviert.");
    return new Response("E-Mail-Intake nicht konfiguriert.", { status: 503 });
  }
  const presented = readBasicAuthPassword(request.headers.get("authorization"));
  if (!presented || !secretsMatch(presented, secret)) {
    return new Response("Nicht autorisiert.", { status: 401 });
  }

  // 2. Grösse begrenzen. Der gesamte Payload liegt beim Verarbeiten im Speicher
  //    des einen Node-Prozesses — ein OOM trifft alle Mandanten gleichzeitig.
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PAYLOAD_BYTES) {
    return new Response("Payload zu gross.", { status: 413 });
  }

  // 3. Missbrauch drosseln, bevor die (kostenpflichtige) KI-Extraktion läuft.
  const herkunft = getTrustedClientIp(request.headers.get("x-forwarded-for"));
  if (!consumeRateLimit(`intake:ip:${herkunft}`, 60, 60_000).allowed) {
    return new Response("Zu viele Anfragen.", { status: 429 });
  }

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

  // Zweite Drosselung je Organisation: Ein einzelner Mandant soll den Dienst
  // (und das KI-Budget) nicht für die anderen aufbrauchen.
  if (!consumeRateLimit(`intake:token:${token}`, 30, 60_000).allowed) {
    return new Response("Zu viele Anfragen.", { status: 429 });
  }

  const organizationId = await getOrganizationIdByIntakeEmailToken(token);
  if (!organizationId) {
    return new Response("Unbekannte Intake-Adresse.", { status: 404 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return new Response("E-Mail-Intake nicht verfügbar (Service-Role fehlt).", { status: 500 });
  }

  // Idempotenz: Postmark liefert bei Zeitüberschreitung erneut zu — ohne
  // diesen Claim entstünde pro Wiederholung ein weiterer Projektentwurf.
  const messageId = mail.MessageID?.trim() || null;
  if (messageId) {
    const claim = await claimIntakeEmailMessage(messageId, organizationId);
    if (!claim.claimed) {
      return Response.json({ projectId: claim.existingProjectId }, { status: 200 });
    }
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

    if (messageId) {
      await recordIntakeEmailProject(messageId, project.id);
    }
    await publish(organizationId, { type: "project.core_changed", projectId: project.id });

    return Response.json({ projectId: project.id }, { status: 200 });
  } catch (e) {
    // Claim wieder freigeben — sonst würde ein Postmark-Retry nach einem
    // fehlgeschlagenen Versuch dauerhaft leer laufen (Claim bereits vergeben,
    // aber nie ein Projekt entstanden).
    if (messageId) {
      await releaseIntakeEmailClaim(messageId).catch(() => {});
    }
    return new Response(e instanceof Error ? e.message : "Anlegen fehlgeschlagen.", { status: 500 });
  }
}
