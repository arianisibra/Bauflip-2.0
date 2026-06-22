"use server";

import { revalidatePath } from "next/cache";
import { requireTechFieldSession } from "@/lib/auth/organization";
import { addTechnicianReport, listActiveOrderFormTemplatesForOrg } from "@/lib/db/repository";
import { validateOrderFormValues } from "@/lib/order-forms/validate-submission";
import { publish } from "@/lib/realtime/publish";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { technicianReportSchema } from "@/lib/validations/forms";

type ActionResult = { success: true } | { success: false; error: string };

export async function submitTechnicianReportAction(
  values: unknown,
  tabId?: string,
): Promise<ActionResult> {
  const session = await requireTechFieldSession();

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
  const templateById = new Map(activeTemplates.map((t) => [t.id, t]));

  const orderFormSubmissions: { templateId: string; valuesJson: Record<string, string> }[] = [];

  for (const entry of v.orderForms ?? []) {
    const tpl = templateById.get(entry.templateId);
    if (!tpl) {
      return { success: false, error: "Unbekannte oder inaktive Bestellformular-Vorlage." };
    }
    const rawValues = entry.values ?? {};
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
        createdByProfileId: session.userId,
        orderFormSubmissions,
        nextStatus: v.nextStatus,
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

  // Notify admin/office in this org. Use `project.core_changed` (not
  // `report.changed`) because submitting a report also mutates the project's
  // status via `nextStatus`, so the office list's status badge needs to
  // refresh — `project.core_changed` invalidates core + list + calendars.
  publish(organizationId, {
    type: "project.core_changed",
    projectId: v.projectId,
    originTabId: tabId,
  });

  return { success: true };
}
