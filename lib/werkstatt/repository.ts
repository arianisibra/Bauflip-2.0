import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Werkstatt für alle Monteure (Kundenwunsch 21.09.2026): Wer in der Werkstatt repariert,
 * ist oft nicht auf dem Projekt eingeteilt — die RLS auf `projects` lässt ihn das Projekt
 * dann weder sehen noch ändern. Statt die RLS für alle Projekte zu öffnen, gibt es genau
 * diesen einen engen Weg: Liste der Werkstatt-Projekte der eigenen Firma (wenige Spalten)
 * und den einen Wechsel `werkstatt → montagebereit`.
 *
 * Service-Role, deshalb prüfen die Abfragen die Firma selbst. Aufrufer müssen
 * `organizationId` aus der Sitzung nehmen — nie aus Eingaben des Browsers.
 */

export type WerkstattProjekt = {
  id: string;
  title: string;
  referenz: string | null;
  adresse: string;
  hinweise: string | null;
  seit: string;
};

export async function listWerkstattProjekte(organizationId: string): Promise<WerkstattProjekt[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase nicht konfiguriert.");
  const { data, error } = await admin
    .from("projects")
    .select("id, title, reference_code, service_street, service_postal_code, service_city, hints_and_notes, updated_at")
    .eq("organization_id", organizationId)
    .eq("status", "werkstatt")
    .is("archived_at", null)
    .order("updated_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    title: String(r.title ?? ""),
    referenz: r.reference_code ? String(r.reference_code) : null,
    adresse: [r.service_street, [r.service_postal_code, r.service_city].filter(Boolean).join(" ")]
      .map((s) => String(s ?? "").trim())
      .filter(Boolean)
      .join(", "),
    hinweise: r.hints_and_notes ? String(r.hints_and_notes) : null,
    seit: String(r.updated_at ?? ""),
  }));
}

/**
 * Setzt ein Werkstatt-Projekt auf «Montagebereit». Bedingt in einem Schritt: nur wenn es
 * noch in der Werkstatt steht und zur Firma gehört — zwei gleichzeitige Klicks oder ein
 * inzwischen vom Büro geänderter Status ändern also nichts. Gleiche Wirkung wie der
 * Büro-Knopf «WERKSTATT FERTIG» (manueller Wechsel, keine Auto-Promotion).
 */
export async function markWerkstattFertig(
  organizationId: string,
  projectId: string,
): Promise<"ok" | "nicht_mehr_in_werkstatt"> {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase nicht konfiguriert.");
  const { data, error } = await admin
    .from("projects")
    .update({
      status: "montagebereit",
      status_updated_source: "manual",
      status_revert_on_appointment_clear: null,
    })
    .eq("id", projectId)
    .eq("organization_id", organizationId)
    .eq("status", "werkstatt")
    .is("archived_at", null)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0 ? "ok" : "nicht_mehr_in_werkstatt";
}
