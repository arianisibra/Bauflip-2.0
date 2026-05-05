"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import {
  createTechnicianAbsence,
  deleteTechnicianAbsence,
  listAllTechnicianAbsences,
} from "@/lib/db/repository";
import type { TechnicianAbsence } from "@/lib/domain/types";
import { technicianAbsenceCreateSchema } from "@/lib/validations/forms";

function ensureOfficeOrAdmin(role: string | undefined): asserts role is "admin" | "office" {
  if (role !== "admin" && role !== "office") {
    throw new Error("Nur Admin und Büro dürfen Abwesenheiten verwalten.");
  }
}

/** Liste aller Abwesenheiten der Organisation (für Mitarbeiter-Drawer). */
export async function listAbsencesAction(): Promise<TechnicianAbsence[]> {
  const session = await getCurrentSession();
  if (!session) return [];
  if (session.role !== "admin" && session.role !== "office") return [];
  return listAllTechnicianAbsences();
}

export async function createAbsenceAction(input: unknown): Promise<TechnicianAbsence> {
  const session = await getCurrentSession();
  if (!session) throw new Error("Nicht angemeldet.");
  ensureOfficeOrAdmin(session.role);

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
    session.user.id,
  );
  revalidatePath("/mitarbeiter");
  revalidatePath("/kalender");
  return created;
}

export async function deleteAbsenceAction(absenceId: string): Promise<{ ok: true }> {
  const session = await getCurrentSession();
  if (!session) throw new Error("Nicht angemeldet.");
  ensureOfficeOrAdmin(session.role);
  if (!absenceId || typeof absenceId !== "string") {
    throw new Error("Ungültige ID.");
  }
  await deleteTechnicianAbsence(absenceId);
  revalidatePath("/mitarbeiter");
  revalidatePath("/kalender");
  return { ok: true };
}
