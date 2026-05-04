"use client";

import { useState } from "react";
import type { OrderFormTemplate, TechnicianReport } from "@/lib/domain/types";
import { computeOrderFormVisibilityMask, isOrderFormFieldEffectivelyRequired } from "@/lib/order-forms/field-runtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";

export type TechnicianReportEditPayload = {
  reportId: string;
  projectId: string;
  outcome: "schaden_behoben" | "schaden_aufgenommen";
  summary?: string;
  measurementsJson?: string;
  workDescription?: string;
  orderForms?: { templateId: string; values: Record<string, string> }[];
};

export function TechnicianReportEditOverlay({
  report,
  projectId,
  templates,
  onClose,
  onSubmit,
  pending,
}: {
  report: TechnicianReport;
  projectId: string;
  templates: OrderFormTemplate[];
  onClose: () => void;
  onSubmit: (v: TechnicianReportEditPayload) => Promise<void>;
  pending: boolean;
}) {
  const [outcome, setOutcome] = useState<"schaden_behoben" | "schaden_aufgenommen">(report.outcome);
  const [summary, setSummary] = useState(report.summary);
  const [workDescription, setWorkDescription] = useState(report.workDescription);
  const [measurementsJson, setMeasurementsJson] = useState(
    report.measurementsJson && report.measurementsJson !== "{}" ? report.measurementsJson : "",
  );
  const [ofValues, setOfValues] = useState<Record<number, Record<string, string>>>(() => {
    const o: Record<number, Record<string, string>> = {};
    report.orderForms.forEach((of_, i) => {
      o[i] = { ...of_.values };
    });
    return o;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const meas = measurementsJson.trim() === "" ? "{}" : measurementsJson.trim();
    const payload: TechnicianReportEditPayload = {
      reportId: report.id,
      projectId,
      outcome,
      summary: summary.trim(),
      workDescription: workDescription.trim(),
      measurementsJson: meas,
      orderForms:
        report.orderForms.length > 0
          ? report.orderForms.map((of_, idx) => ({
              templateId: of_.templateId,
              values: ofValues[idx] ?? of_.values,
            }))
          : undefined,
    };
    await onSubmit(payload);
  };

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto overflow-x-hidden overscroll-contain bg-black/40"
      role="dialog"
      aria-modal
    >
      <div className="flex min-h-dvh items-end justify-center p-4 pb-8 sm:items-center">
        <div className="max-h-[min(90dvh,720px)] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-background shadow-xl">
        <div className="sticky top-0 z-[1] flex items-center justify-between gap-2 border-b border-border bg-background px-4 py-3">
          <h4 className="text-sm font-semibold">Rapport bearbeiten</h4>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>
            Schliessen
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          {report.createdByDisplayName?.trim() ? (
            <p className="text-xs text-muted-foreground">
              Erfasst von <span className="font-medium text-foreground">{report.createdByDisplayName.trim()}</span>
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Der Projekt-Status bleibt dabei unverändert. Anpassungen sind z. B. für Tippfehler oder nachträgliche
            Präzisierungen.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="edit-outcome" className="text-xs">
              Ergebnis
            </Label>
            <select
              id="edit-outcome"
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-base"
              value={outcome}
              onChange={(e) =>
                setOutcome(e.target.value as "schaden_behoben" | "schaden_aufgenommen")
              }
              disabled={pending}
            >
              <option value="schaden_behoben">Behoben / Fertig</option>
              <option value="schaden_aufgenommen">Aufgenommen / Nicht fertig</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-summary" className="text-xs">
              Kurztext
            </Label>
            <Textarea
              id="edit-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-work" className="text-xs">
              Arbeit / Material
            </Label>
            <Textarea
              id="edit-work"
              value={workDescription}
              onChange={(e) => setWorkDescription(e.target.value)}
              rows={4}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-meas" className="text-xs">
              Masse / Notizen
            </Label>
            <Textarea
              id="edit-meas"
              value={measurementsJson}
              onChange={(e) => setMeasurementsJson(e.target.value)}
              rows={3}
              disabled={pending}
              placeholder="JSON oder Freitext"
              className="font-mono"
            />
          </div>

          {report.orderForms.length > 0 ? (
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Bestellformulare
              </p>
              {report.orderForms.map((of_, ofIdx) => {
                const tpl = templates.find((t) => t.id === of_.templateId);
                const fields = tpl?.fields ?? of_.fields;
                const name = tpl?.name ?? of_.templateName;
                const vals = ofValues[ofIdx] ?? of_.values;
                const visibility = computeOrderFormVisibilityMask(fields, vals);
                if (!tpl) {
                  return (
                    <div
                      key={`${report.id}-of-${ofIdx}`}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-800 dark:text-amber-200"
                    >
                      <p className="font-medium">{name}</p>
                      <p className="mt-1">
                        Diese Bestellformular-Vorlage ist inaktiv oder fehlt. Bitte Vorlage reaktivieren, sonst kann
                        der Rapport nicht gespeichert werden.
                      </p>
                    </div>
                  );
                }
                return (
                  <div key={`${report.id}-of-${ofIdx}`} className="space-y-2 rounded-lg border border-border/80 p-3">
                    <p className="text-xs font-semibold text-foreground">{name}</p>
                    {fields.map((f, fieldIndex) => {
                      if (!visibility[fieldIndex]) return null;
                      const effReq = isOrderFormFieldEffectivelyRequired(f, fieldIndex, fields, visibility, vals);
                      const v = vals[f.key] ?? "";
                      const id = `edit-of-${ofIdx}-${f.key}`;
                      const setVal = (next: string) => {
                        setOfValues((prev) => ({
                          ...prev,
                          [ofIdx]: { ...(prev[ofIdx] ?? {}), [f.key]: next },
                        }));
                      };
                      return (
                        <div key={f.key} className="space-y-1">
                          <Label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium">
                            {f.label}
                            {effReq ? (
                              <Badge variant="destructive" className="px-1 py-0 text-[10px]">
                                Pflicht
                              </Badge>
                            ) : null}
                          </Label>
                          {f.type === "textarea" ? (
                            <Textarea
                              id={id}
                              rows={3}
                              value={v}
                              onChange={(e) => setVal(e.target.value)}
                              disabled={pending}
                            />
                          ) : f.type === "select" && f.options?.length ? (
                            <select
                              id={id}
                              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-base"
                              value={v}
                              onChange={(e) => setVal(e.target.value)}
                              disabled={pending}
                            >
                              <option value="">—</option>
                              {f.options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              id={id}
                              type={f.type === "number" ? "text" : "text"}
                              inputMode={f.type === "number" ? "decimal" : undefined}
                              value={v}
                              onChange={(e) => setVal(e.target.value)}
                              disabled={pending}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <BauflipLoadingButtonLabel variant="onPrimary">Speichern …</BauflipLoadingButtonLabel> : "Speichern"}
            </Button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
