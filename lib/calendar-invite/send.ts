import "server-only";

import { getQuotePdfProjectHead } from "@/lib/db/quotes";
import { getOrganizationBranding } from "@/lib/db/repository";
import {
  buildInviteCancel,
  buildInviteRequest,
  type CalendarInviteEvent,
} from "@/lib/calendar-invite/ics";
import { getMailFromAddress, isMailConfigured, sendMail } from "@/lib/mail/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Minimale Termindaten für eine Einladung — aus Action-Input oder Vorab-Load. */
export type InviteAppointmentData = {
  appointmentId: string;
  projectId: string;
  kind: string;
  startsAtIso: string;
  endsAtIso: string;
  planningNotes: string | null;
};

const KIND_LABELS: Record<string, string> = {
  besichtigung: "Besichtigung",
  ausfuehrung: "Ausführung",
};

/**
 * Empfänger auflösen: Opt-out (profiles) prüfen, E-Mail über die Auth-Admin-API
 * (profiles hat keine E-Mail-Spalte). Fehlende Konfiguration → leere Liste.
 */
async function resolveRecipients(userIds: string[]): Promise<string[]> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) return [];

  const { data: prefs } = await supabase
    .from("profiles")
    .select("id, appointment_invites_enabled")
    .in("id", ids);
  const enabled = new Set(
    ((prefs ?? []) as { id: string; appointment_invites_enabled: boolean | null }[])
      .filter((p) => p.appointment_invites_enabled !== false)
      .map((p) => p.id),
  );

  // Parallel statt nacheinander: Die Abfragen sind voneinander unabhängig, und
  // der Versand hängt an dieser Kette.
  const ergebnisse = await Promise.all(
    ids
      .filter((id) => enabled.has(id))
      .map(async (id) => {
        try {
          const { data } = await admin.auth.admin.getUserById(id);
          return data.user?.email?.trim() || null;
        } catch {
          // Einzelner Lookup-Fehler darf die übrigen Einladungen nicht verhindern.
          return null;
        }
      }),
  );
  return ergebnisse.filter((email): email is string => Boolean(email));
}

/**
 * Alles, was für das Ereignis nötig ist und NICHT vom Empfänger abhängt.
 *
 * Vorher holte die Aufbaufunktion Projekt und Branding für jeden Empfänger neu —
 * bei zwei zugewiesenen Monteuren also vier Abfragen für dasselbe Projekt.
 * Der Kontext wird jetzt einmal geladen, das Ereignis daraus je Empfänger gebaut.
 */
type EinladungsKontext = {
  fromAddress: string;
  organizerName: string;
  summary: string;
  description: string | null;
  location: string | null;
  sequence: number;
};

async function ladeEinladungsKontext(
  appointment: InviteAppointmentData,
): Promise<EinladungsKontext | null> {
  const fromAddress = getMailFromAddress();
  if (!fromAddress) return null;

  const [project, orgIdRow] = await Promise.all([
    getQuotePdfProjectHead(appointment.projectId),
    (async () => {
      const supabase = await createSupabaseServerClient();
      if (!supabase) return null;
      const { data } = await supabase
        .from("projects")
        .select("organization_id")
        .eq("id", appointment.projectId)
        .maybeSingle();
      return (data as { organization_id?: string | null } | null)?.organization_id ?? null;
    })(),
  ]);
  if (!project) return null;
  const branding = await getOrganizationBranding(orgIdRow);

  const kindLabel = KIND_LABELS[appointment.kind] ?? "Termin";
  const location = [
    project.serviceStreet,
    [project.servicePostalCode, project.serviceCity].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const descriptionParts = [
    project.referenceCode ? `Projekt-Nr. ${project.referenceCode}` : null,
    project.tenantName ? `Kontakt: ${project.tenantName}` : null,
    appointment.planningNotes ? `Notizen: ${appointment.planningNotes}` : null,
  ].filter(Boolean);

  return {
    fromAddress,
    organizerName: branding.name,
    summary: `${kindLabel}: ${project.title}`,
    description: descriptionParts.length > 0 ? descriptionParts.join("\n") : null,
    location: location || null,
    // Einmal bestimmt statt je Empfänger: Dasselbe Ereignis soll bei allen
    // Beteiligten dieselbe Sequenznummer tragen.
    sequence: Math.floor(Date.now() / 1000),
  };
}

function baueEreignis(
  kontext: EinladungsKontext,
  appointment: InviteAppointmentData,
  attendeeEmail: string,
): CalendarInviteEvent {
  return {
    uid: `${appointment.appointmentId}@bauflip`,
    sequence: kontext.sequence,
    startsAtIso: appointment.startsAtIso,
    endsAtIso: appointment.endsAtIso,
    summary: kontext.summary,
    description: kontext.description,
    location: kontext.location,
    organizer: { name: kontext.organizerName, email: kontext.fromAddress },
    attendeeEmail,
  };
}

/**
 * Einladung (REQUEST) oder Absage (CANCEL) an die zugewiesenen Monteure senden.
 * Fehler werden geloggt, aber nie geworfen — der Versand darf Termin-Mutationen
 * nicht blockieren. Ohne SMTP-Konfiguration ist die Funktion ein No-op.
 */
export async function sendAppointmentInvites(
  method: "REQUEST" | "CANCEL",
  appointment: InviteAppointmentData,
  technicianUserIds: (string | null | undefined)[],
): Promise<void> {
  try {
    if (!isMailConfigured()) return;
    const recipients = await resolveRecipients(
      technicianUserIds.filter((id): id is string => Boolean(id)),
    );
    if (recipients.length === 0) return;

    // Einmal laden, nicht je Empfänger.
    const kontext = await ladeEinladungsKontext(appointment);
    if (!kontext) return;
    const kindLabel = KIND_LABELS[appointment.kind] ?? "Termin";
    const dateLabel = new Date(appointment.startsAtIso).toLocaleString("de-CH", {
      timeZone: "Europe/Zurich",
      dateStyle: "medium",
      timeStyle: "short",
    });

    for (const email of recipients) {
      const event = baueEreignis(kontext, appointment, email);
      const ics = method === "REQUEST" ? buildInviteRequest(event) : buildInviteCancel(event);
      await sendMail({
        to: email,
        subject:
          method === "REQUEST"
            ? `Einsatz: ${kindLabel} am ${dateLabel}`
            : `Absage: ${kindLabel} am ${dateLabel}`,
        text:
          method === "REQUEST"
            ? `Dir wurde ein Einsatz zugewiesen. Details im angehängten Termin — bitte annehmen, damit er im Kalender fixiert ist.`
            : `Dieser Einsatz wurde abgesagt oder neu zugewiesen; der Termin wird aus deinem Kalender entfernt.`,
        fromName: event.organizer.name,
        icalEvent: { method, content: ics },
      });
    }
  } catch (err) {
    console.warn("[bauflip] appointment invite failed:", err);
  }
}

/** Termin-Daten vor Mutationen laden (für CANCEL nach Löschung/Neuzuweisung). */
export async function loadInviteAppointmentData(
  appointmentId: string,
): Promise<(InviteAppointmentData & { assignedTechnicianId: string | null; assignedTechnicianId2: string | null }) | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("appointments")
    .select("id, project_id, kind, starts_at, ends_at, planning_notes, assigned_technician_id, assigned_technician_id_2")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    appointmentId: String(row.id),
    projectId: String(row.project_id),
    kind: String(row.kind ?? "besichtigung"),
    startsAtIso: String(row.starts_at),
    endsAtIso: String(row.ends_at),
    planningNotes: row.planning_notes != null ? String(row.planning_notes) : null,
    assignedTechnicianId: row.assigned_technician_id != null ? String(row.assigned_technician_id) : null,
    assignedTechnicianId2: row.assigned_technician_id_2 != null ? String(row.assigned_technician_id_2) : null,
  };
}
