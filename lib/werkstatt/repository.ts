import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * «Werkstatt fertig» durch den Monteur (Kundenwunsch 21.09.2026): gleicher Wechsel wie der
 * Büro-Knopf, `werkstatt → montagebereit`, manuell (keine Auto-Promotion).
 *
 * Bewusst mit dem Client des angemeldeten Nutzers, nicht mit Service-Role: Die RLS auf
 * `projects` erlaubt Monteuren das Ändern nur für Projekte, auf denen sie eingeteilt sind —
 * genau die, deren Auftrag sie öffnen können. Bedingt in einem Schritt (nur solange noch
 * `werkstatt`), damit ein Doppelklick oder ein inzwischen vom Büro geänderter Status nichts
 * überschreibt.
 */
export async function markWerkstattFertig(projectId: string): Promise<"ok" | "nicht_umgeschaltet"> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht konfiguriert.");
  const { data, error } = await supabase
    .from("projects")
    .update({
      status: "montagebereit",
      status_updated_source: "manual",
      status_revert_on_appointment_clear: null,
    })
    .eq("id", projectId)
    .eq("status", "werkstatt")
    .select("id, organization_id");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0 ? "ok" : "nicht_umgeschaltet";
}
