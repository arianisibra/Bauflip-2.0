"use server";

import { requireOfficeSession } from "@/lib/auth/organization";
import { getQuotePdfProjectHead } from "@/lib/db/quotes";
import { getOrganizationBranding } from "@/lib/db/repository";
import { isMailConfigured, sendMail } from "@/lib/mail/send";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { appointmentConfirmationSendSchema } from "@/lib/validations/forms";

const APPOINTMENT_KIND_LABELS: Record<string, string> = {
  besichtigung: "Besichtigung",
  ausfuehrung: "Ausführung",
};

function formatConfirmationDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-CH", {
    timeZone: "Europe/Zurich",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatConfirmationTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-CH", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function sendAppointmentConfirmationAction(
  values: unknown,
): Promise<{ ok: true }> {
  await requireOfficeSession();
  const parsed = appointmentConfirmationSendSchema.safeParse(values);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }
  if (!isMailConfigured()) {
    throw new Error("E-Mail-Versand ist nicht konfiguriert (SMTP_HOST/MAIL_FROM in .env setzen).");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  // RLS begrenzt auf die eigene Organisation.
  const { data: appt, error: apptError } = await supabase
    .from("appointments")
    .select("id, project_id, kind, starts_at, ends_at")
    .eq("id", parsed.data.appointmentId)
    .eq("project_id", parsed.data.projectId)
    .maybeSingle();
  if (apptError) throw new Error(apptError.message);
  if (!appt) throw new Error("Termin nicht gefunden.");

  const { data: projRow, error: projError } = await supabase
    .from("projects")
    .select("organization_id")
    .eq("id", parsed.data.projectId)
    .maybeSingle();
  if (projError) throw new Error(projError.message);
  const organizationId = (projRow as { organization_id?: string | null } | null)?.organization_id;
  if (!organizationId) throw new Error("Projekt nicht gefunden.");

  const [project, branding] = await Promise.all([
    getQuotePdfProjectHead(parsed.data.projectId),
    getOrganizationBranding(organizationId),
  ]);
  if (!project) throw new Error("Projekt nicht gefunden.");

  const startsAt = String((appt as Record<string, unknown>).starts_at);
  const endsAt = String((appt as Record<string, unknown>).ends_at);
  const kindLabel = APPOINTMENT_KIND_LABELS[String((appt as Record<string, unknown>).kind)] ?? "Termin";
  const addressLine = [
    project.serviceStreet,
    [project.servicePostalCode, project.serviceCity].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const text =
    `Guten Tag\n\n` +
    `Gerne bestätigen wir Ihnen den folgenden Termin:\n\n` +
    `Termin: ${kindLabel}\n` +
    `Datum: ${formatConfirmationDate(startsAt)}\n` +
    `Zeit: ${formatConfirmationTime(startsAt)}–${formatConfirmationTime(endsAt)} Uhr\n` +
    (addressLine ? `Adresse: ${addressLine}\n` : "") +
    `\nSollte Ihnen der Termin nicht passen, melden Sie sich bitte bei uns.\n` +
    `\nFreundliche Grüsse\n${branding.name}`;

  await sendMail({
    to: parsed.data.recipientEmail,
    subject: `Terminbestätigung ${formatConfirmationDate(startsAt)} — ${branding.name}`,
    text,
    fromName: branding.name,
  });

  return { ok: true };
}
