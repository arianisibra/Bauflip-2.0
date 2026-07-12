import "server-only";

import { createBexioContact, findBexioContact } from "@/lib/bexio/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Bexio-Kontakt für ein Projekt finden oder anlegen (Suche per Mail, sonst per Name) —
 * Treffer/Neuanlage wird auf projects.bexio_contact_id zwischengespeichert, damit nicht
 * bei jedem Rechnungs-Push erneut gesucht/angelegt wird.
 */
export async function resolveBexioContactId(
  token: string,
  project: { id: string; bexioContactId: number | null; name: string; email: string | null },
): Promise<number> {
  if (project.bexioContactId) return project.bexioContactId;

  const existing = await findBexioContact(token, { email: project.email, name: project.name });
  const contactId = existing
    ? existing.id
    : (await createBexioContact(token, { name: project.name, email: project.email })).id;

  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.from("projects").update({ bexio_contact_id: contactId }).eq("id", project.id);
  }

  return contactId;
}
