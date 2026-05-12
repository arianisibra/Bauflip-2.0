"use client";

import { useCallback, useState } from "react";
import type { OrderFormTemplate, TechnicianReport } from "@/lib/domain/types";
import type { OrderFormFieldDef } from "@/lib/order-forms/schema";
import { isOrderFormFieldEffectivelyRequired } from "@/lib/order-forms/field-runtime";
import { isSinglePositionOrderFormTemplate } from "@/lib/order-forms/template-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { ClipboardList, Plus } from "lucide-react";

export type OrderFormEditLineRef = { lineId: string; templateId: string; values: Record<string, string> };

export type TechnicianReportEditPayload = {
  reportId: string;
  projectId: string;
  outcome: "schaden_behoben" | "schaden_aufgenommen";
  summary?: string;
  measurementsJson?: string;
  workDescription?: string;
  /** Minuten am Rapport; `null` = keine Angabe. */
  timeSpentMinutes?: number | null;
  orderForms?: { templateId: string; values: Record<string, string> }[];
};

function initOrderFormLines(report: TechnicianReport): OrderFormEditLineRef[] {
  return report.orderForms.map((of_, i) => ({
    lineId: `existing-${i}`,
    templateId: of_.templateId,
    values: { ...of_.values },
  }));
}

function renderOrderFormFieldInput(
  f: OrderFormFieldDef,
  v: string,
  setVal: (next: string) => void,
  id: string,
  pending: boolean,
) {
  const ph =
    f.placeholder?.trim() ||
    (f.type === "artikel" ? "z. B. Artikel-Nr. / Bezeichnung" : undefined);

  if (f.type === "textarea") {
    return (
      <Textarea id={id} rows={3} value={v} placeholder={ph} onChange={(e) => setVal(e.target.value)} disabled={pending} />
    );
  }
  if (f.type === "select" && f.options?.length) {
    return (
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
    );
  }
  if (f.type === "number") {
    return (
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        placeholder={ph}
        value={v}
        onChange={(e) => setVal(e.target.value)}
        disabled={pending}
      />
    );
  }
  return (
    <Input id={id} type="text" placeholder={ph} value={v} onChange={(e) => setVal(e.target.value)} disabled={pending} />
  );
}

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
  const [timeSpentMinutesStr, setTimeSpentMinutesStr] = useState(
    report.timeSpentMinutes != null && Number.isFinite(report.timeSpentMinutes)
      ? String(report.timeSpentMinutes)
      : "",
  );
  const [timeInputError, setTimeInputError] = useState<string | null>(null);
  const [orderFormLines, setOrderFormLines] = useState<OrderFormEditLineRef[]>(() => initOrderFormLines(report));

  const toggleOrderFormTemplate = useCallback((templateId: string) => {
    setOrderFormLines((prev) => {
      const has = prev.some((l) => l.templateId === templateId);
      if (has) {
        return prev.filter((l) => l.templateId !== templateId);
      }
      return [...prev, { templateId, lineId: crypto.randomUUID(), values: {} }];
    });
  }, []);

  const addOrderFormLine = useCallback(
    (templateId: string) => {
      const tpl = templates.find((item) => item.id === templateId);
      const singlePositionOnly = tpl ? isSinglePositionOrderFormTemplate(tpl) : false;
      setOrderFormLines((prev) => {
        if (singlePositionOnly && prev.some((line) => line.templateId === templateId)) {
          return prev;
        }
        return [...prev, { templateId, lineId: crypto.randomUUID(), values: {} }];
      });
    },
    [templates],
  );

  const removeOrderFormLine = useCallback((lineId: string) => {
    setOrderFormLines((prev) => prev.filter((l) => l.lineId !== lineId));
  }, []);

  const setOrderFormFieldValue = useCallback((lineId: string, key: string, next: string) => {
    setOrderFormLines((prev) =>
      prev.map((line) =>
        line.lineId === lineId ? { ...line, values: { ...line.values, [key]: next } } : line,
      ),
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const meas = measurementsJson.trim() === "" ? "{}" : measurementsJson.trim();
    const tStr = timeSpentMinutesStr.trim();
    let timeSpentMinutes: number | null = null;
    if (tStr !== "") {
      const n = Number(tStr.replace(",", "."));
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n) || n > 20000) {
        setTimeInputError("Bitte eine ganze Zahl zwischen 0 und 20000 eingeben.");
        return;
      }
      setTimeInputError(null);
      timeSpentMinutes = n;
    } else {
      setTimeInputError(null);
    }

    const includeOrderForms = templates.length > 0;
    const payload: TechnicianReportEditPayload = {
      reportId: report.id,
      projectId,
      outcome,
      summary: summary.trim(),
      workDescription: workDescription.trim(),
      measurementsJson: meas,
      timeSpentMinutes,
      orderForms: includeOrderForms
        ? orderFormLines.map(({ templateId, values }) => ({
            templateId,
            values,
          }))
        : undefined,
    };
    await onSubmit(payload);
  };

  const showOrderFormSection = templates.length > 0 || orderFormLines.length > 0;
  const templateById = new Map(templates.map((t) => [t.id, t]));

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
                onChange={(e) => setOutcome(e.target.value as "schaden_behoben" | "schaden_aufgenommen")}
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
            <div className="space-y-1.5">
              <Label htmlFor="edit-time" className="text-xs">
                Arbeitszeit (Minuten, optional)
              </Label>
              <Input
                id="edit-time"
                type="text"
                inputMode="numeric"
                placeholder="z. B. 90"
                value={timeSpentMinutesStr}
                onChange={(e) => {
                  setTimeSpentMinutesStr(e.target.value.replace(/[^\d]/g, ""));
                  setTimeInputError(null);
                }}
                disabled={pending}
              />
              {timeInputError ? <p className="text-xs text-destructive">{timeInputError}</p> : null}
            </div>

            {showOrderFormSection ? (
              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-start gap-2">
                  <ClipboardList className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Bestellformulare
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Alle Felder sind sichtbar — auch wenn sie beim Einsatz noch leer waren.
                    </p>
                  </div>
                </div>

                {templates.length > 0 ? (
                  <div className="space-y-2">
                    {templates.map((tpl) => {
                      const linesForTpl = orderFormLines.filter((l) => l.templateId === tpl.id);
                      const selected = linesForTpl.length > 0;
                      const singlePositionOnly = isSinglePositionOrderFormTemplate(tpl);
                      return (
                        <Card key={tpl.id} size="sm" className="overflow-hidden border-border shadow-sm">
                          <label className="flex cursor-pointer items-start gap-3 p-3 transition-colors hover:bg-muted/30">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleOrderFormTemplate(tpl.id)}
                              className="mt-1 size-4 shrink-0 rounded border-input accent-primary"
                              aria-label={`${tpl.name} auswählen`}
                              disabled={pending}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {tpl.supplierName?.trim() ? (
                                  <Badge variant="outline" className="text-[10px]">
                                    {tpl.supplierName.trim()}
                                  </Badge>
                                ) : null}
                                <span className="text-sm font-semibold text-foreground">{tpl.name}</span>
                              </div>
                              {tpl.description ? (
                                <p className="mt-0.5 text-xs text-muted-foreground">{tpl.description}</p>
                              ) : null}
                            </div>
                          </label>

                          {selected ? (
                            <CardContent className="space-y-3 border-t border-border/60 bg-muted/10 px-3 py-3 pt-3">
                              {linesForTpl.map((line, idx) => {
                                const fields = tpl.fields;
                                const vals = line.values;
                                const visibilityTrue = fields.map(() => true);
                                return (
                                  <div
                                    key={line.lineId}
                                    className="space-y-3 rounded-lg border border-border/60 bg-background/40 p-3"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                        Position {idx + 1}
                                      </p>
                                      {linesForTpl.length > 1 ? (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 text-xs text-destructive hover:text-destructive"
                                          onClick={() => removeOrderFormLine(line.lineId)}
                                          disabled={pending}
                                        >
                                          Entfernen
                                        </Button>
                                      ) : null}
                                    </div>
                                    {fields.map((f, fieldIndex) => {
                                      const effReq = isOrderFormFieldEffectivelyRequired(
                                        f,
                                        fieldIndex,
                                        fields,
                                        visibilityTrue,
                                        vals,
                                      );
                                      const v = vals[f.key] ?? "";
                                      const id = `edit-of-${line.lineId}-${f.key}`;
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
                                          {renderOrderFormFieldInput(f, v, (next) =>
                                            setOrderFormFieldValue(line.lineId, f.key, next), id, pending)}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                              {!singlePositionOnly ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-full gap-1.5 text-xs"
                                  onClick={() => addOrderFormLine(tpl.id)}
                                  disabled={pending}
                                >
                                  <Plus className="size-3.5" />
                                  Weitere Position ({tpl.name})
                                </Button>
                              ) : (
                                <p className="text-[11px] text-muted-foreground">
                                  Für Ersatzteile ist nur eine Position erlaubt.
                                </p>
                              )}
                            </CardContent>
                          ) : null}
                        </Card>
                      );
                    })}
                  </div>
                ) : null}

                {templates.length === 0 && orderFormLines.length > 0
                  ? orderFormLines.map((line) => {
                      const stored = report.orderForms.find((of_) => of_.templateId === line.templateId);
                      const fields = stored?.fields ?? [];
                      const name = stored?.templateName ?? line.templateId;
                      const vals = line.values;
                      const visibilityTrue = fields.map(() => true);
                      return (
                        <div
                          key={line.lineId}
                          className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-800 dark:text-amber-200"
                        >
                          <p className="font-medium">{name}</p>
                          <p className="mt-1">
                            Keine aktive Vorlage geladen. Bitte Vorlage reaktivieren, sonst kann der Rapport nicht
                            gespeichert werden.
                          </p>
                          {fields.map((f, fieldIndex) => {
                            const effReq = isOrderFormFieldEffectivelyRequired(
                              f,
                              fieldIndex,
                              fields,
                              visibilityTrue,
                              vals,
                            );
                            const v = vals[f.key] ?? "";
                            const id = `edit-of-orphan-${line.lineId}-${f.key}`;
                            return (
                              <div key={f.key} className="mt-2 space-y-1">
                                <Label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium">
                                  {f.label}
                                  {effReq ? (
                                    <Badge variant="destructive" className="px-1 py-0 text-[10px]">
                                      Pflicht
                                    </Badge>
                                  ) : null}
                                </Label>
                                {renderOrderFormFieldInput(f, v, (next) =>
                                  setOrderFormFieldValue(line.lineId, f.key, next), id, pending)}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })
                  : null}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <BauflipLoadingButtonLabel variant="onPrimary">Speichern …</BauflipLoadingButtonLabel>
                ) : (
                  "Speichern"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
