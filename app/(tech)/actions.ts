"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { addTechnicianReport, listActiveOrderFormTemplatesForOrg } from "@/lib/db/repository";
import { validateOrderFormValues } from "@/lib/order-forms/validate-submission";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { technicianReportSchema } from "@/lib/validations/forms";

type ActionResult = { success: true } | { success: false; error: string };

export async function submitTechnicianReportAction(values: unknown): Promise<ActionResult> {
  const session = await getCurrentSession();
  if (!session || session.role !== "technician") {
    return { success: false, error: "Keine Berechtigung." };
  }

  const parsed = technicianReportSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }

  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { success: false, error: "Supabase nicht konfiguriert." };
  }

  const { data: proj, error: projErr } = await supabase
    .from("projects")
    .select("organization_id")
    .eq("id", v.projectId)
    .maybeSingle();

  if (projErr || !proj?.organization_id) {
    return { success: false, error: "Projekt nicht gefunden." };
  }

  const organizationId = String(proj.organization_id);
  const activeTemplates = await listActiveOrderFormTemplatesForOrg(organizationId);
  const fromClient = new Map((v.orderForms ?? []).map((x) => [x.templateId, x.values]));

  const orderFormSubmissions: { templateId: string; valuesJson: Record<string, string> }[] = [];

  for (const tpl of activeTemplates) {
    const rawValues = fromClient.get(tpl.id) ?? {};
    try {
      const validated = validateOrderFormValues(tpl.id, tpl.fields, rawValues);
      if (Object.keys(validated).length > 0) {
        orderFormSubmissions.push({ templateId: tpl.id, valuesJson: validated });
      } else if (tpl.fields.some((f) => f.required)) {
        return { success: false, error: `Bestellformular „${tpl.name}" ist unvollständig.` };
      }
    } catch (validationErr) {
      return {
        success: false,
        error: validationErr instanceof Error ? validationErr.message : "Validierung fehlgeschlagen.",
      };
    }
  }

  try {
    await addTechnicianReport(
      {
        projectId: v.projectId,
        outcome: v.outcome,
        summary: v.summary?.trim() ?? "",
        measurementsJson: (v.measurementsJson?.trim() || "{}") as string,
        workDescription: v.workDescription?.trim() ?? "",
        timeSpentMinutes: null,
      },
      {
        createdByProfileId: session.user.id,
        orderFormSubmissions,
      },
    );
  } catch (dbErr) {
    return {
      success: false,
      error: dbErr instanceof Error ? dbErr.message : "Speichern fehlgeschlagen.",
    };
  }

  revalidatePath("/tag");
  revalidatePath(`/auftrag/${v.projectId}`);
  return { success: true };
}
