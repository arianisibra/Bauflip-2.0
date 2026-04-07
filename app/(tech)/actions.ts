"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { addTechnicianReport } from "@/lib/db/repository";
import { technicianReportSchema } from "@/lib/validations/forms";

export async function submitTechnicianReportAction(values: unknown) {
  const session = await getCurrentSession();
  if (!session || session.role !== "technician") {
    throw new Error("Keine Berechtigung.");
  }

  const parsed = technicianReportSchema.safeParse(values);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }

  const v = parsed.data;
  await addTechnicianReport({
    projectId: v.projectId,
    outcome: v.outcome,
    summary: v.summary?.trim() ?? "",
    measurementsJson: (v.measurementsJson?.trim() || "{}") as string,
    workDescription: v.workDescription?.trim() ?? "",
    timeSpentMinutes: null,
  });

  revalidatePath("/tag");
  revalidatePath(`/auftrag/${v.projectId}`);
}
