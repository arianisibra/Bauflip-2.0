"use server";

import { getOfficeSessionOrNull, requireOfficeSession } from "@/lib/auth/organization";
import {
  createTechnicianAbsence,
  deleteTechnicianAbsence,
  listAllTechnicianAbsences,
} from "@/lib/db/repository";
import type { TechnicianAbsence } from "@/lib/domain/types";
import { technicianAbsenceCreateSchema } from "@/lib/validations/forms";

/** Liste aller Abwesenheiten der Organisation (für Mitarbeiter-Drawer). */
export async function listAbsencesAction(): Promise<TechnicianAbsence[]> {
  const session = await getOfficeSessionOrNull();
  if (!session) return [];
  return listAllTechnicianAbsences();
}

export async function createAbsenceAction(input: unknown): Promise<TechnicianAbsence> {
  const session = await requireOfficeSession();

  const parsed = technicianAbsenceCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }

  const created = await createTechnicianAbsence(
    {
      technicianId: parsed.data.technicianId,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      kind: parsed.data.kind,
      note: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
    },
    session.userId,
  );
  return created;
}

export async function deleteAbsenceAction(absenceId: string): Promise<{ ok: true }> {
  await requireOfficeSession();
  if (!absenceId || typeof absenceId !== "string") {
    throw new Error("Ungültige ID.");
  }
  await deleteTechnicianAbsence(absenceId);
  return { ok: true };
}
