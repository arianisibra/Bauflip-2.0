import "server-only";

import { createBexioContact, findBexioContact } from "@/lib/bexio/client";
import { getLinkedBexioContactForProject, setContactBexioId } from "@/lib/db/contacts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function cacheOnProject(projectId: string, bexioContactId: number): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.from("projects").update({ bexio_contact_id: bexioContactId }).eq("id", projectId);
  }
}

/**
 * Bexio-Kontakt für ein Projekt finden oder anlegen.
 *
 * Reihenfolge (verhindert Dubletten in Bexio):
 *  1. Projekt-Cache (`projects.bexio_contact_id`) — schnellster Weg.
 *  2. **Verknüpfter Bauflip-Kontakt** (Verwaltung bevorzugt): hat er schon einen
 *     `bexio_contact_id`, wird er direkt genutzt → dieselbe Verwaltung zeigt über
 *     ALLE Projekte auf EINEN Bexio-Kontakt.
 *  3. Sonst per E-Mail/Name suchen bzw. anlegen — mit den Daten des verknüpften
 *     Kontakts (falls vorhanden), sonst des Projekts. Ergebnis wird auf dem Projekt
 *     UND (falls verknüpft) auf dem Bauflip-Kontakt zwischengespeichert.
 */
export async function resolveBexioContactId(
  token: string,
  project: { id: string; bexioContactId: number | null; name: string; email: string | null },
): Promise<number> {
  if (project.bexioContactId) return project.bexioContactId;

  const linked = await getLinkedBexioContactForProject(project.id);

  if (linked?.bexioContactId) {
    await cacheOnProject(project.id, linked.bexioContactId);
    return linked.bexioContactId;
  }

  const searchName = linked?.name || project.name;
  const searchEmail = linked?.email ?? project.email;

  const existing = await findBexioContact(token, { email: searchEmail, name: searchName });
  const contactId = existing
    ? existing.id
    : (await createBexioContact(token, { name: searchName, email: searchEmail })).id;

  await cacheOnProject(project.id, contactId);
  if (linked?.contactId) {
    // Für künftige Projekte derselben Verwaltung/desselben Mieters wiederverwenden.
    await setContactBexioId(linked.contactId, contactId);
  }

  return contactId;
}
