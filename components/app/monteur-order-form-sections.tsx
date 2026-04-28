"use client";

import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import type { OrderFormTemplate } from "@/lib/domain/types";
import {
  computeOrderFormVisibilityMask,
  isOrderFormFieldEffectivelyRequired,
} from "@/lib/order-forms/field-runtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, Plus } from "lucide-react";

const ORDER_FORMS_ROOT_ATTR = "data-monteur-order-forms";

function isSinglePositionTemplate(tpl: OrderFormTemplate): boolean {
  const name = tpl.name.toLowerCase();
  const slug = tpl.slug.toLowerCase();
  return name.includes("ersatzteile") || slug.includes("ersatzteile");
}

/** Nur markierte Felder — vermeidet z. B. «Entfernen» (steht im DOM vor den Inputs). */
const ORDER_FORM_FIELD_ATTR = "[data-order-form-field]";

function listFocusableInOrderForms(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(ORDER_FORM_FIELD_ATTR)).filter((el) => {
    if (el.closest("[data-radix-popper-content-wrapper]")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (el.hasAttribute("disabled")) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return el.getClientRects().length > 0;
  });
}

function focusNextInOrderForms(current: HTMLElement): boolean {
  const root = current.closest(`[${ORDER_FORMS_ROOT_ATTR}]`);
  if (!(root instanceof HTMLElement)) return false;
  const list = listFocusableInOrderForms(root);
  const i = list.indexOf(current);
  if (i === -1) return false;
  const next = list[i + 1];
  if (!next) return false;
  next.focus();
  return true;
}

function handleOrderFormEnterKeyNav(e: KeyboardEvent<HTMLElement>): void {
  if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
  if (e.shiftKey) return;
  const el = e.currentTarget;
  if (el instanceof HTMLTextAreaElement) return;
  if (!(el instanceof HTMLInputElement)) return;
  const t = el.type;
  if (t === "checkbox" || t === "radio" || t === "submit" || t === "button") return;
  focusNextInOrderForms(el);
  e.preventDefault();
}

function OrderFormFieldsForTemplate({ tpl, lineId }: { tpl: OrderFormTemplate; lineId: string }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const fields = tpl.fields;

  const visibility = useMemo(() => computeOrderFormVisibilityMask(fields, values), [fields, values]);

  const setVal = (key: string, v: string) => {
    setValues((prev) => ({ ...prev, [key]: v }));
  };

  return (
    <>
      {fields.map((f, index) => {
        if (!visibility[index]) {
          return null;
        }
        const name = `orderForm__${tpl.id}__${lineId}__${f.key}`;
        const effReq = isOrderFormFieldEffectivelyRequired(f, index, fields, visibility, values);
        const ph =
          f.placeholder?.trim() ||
          (f.type === "artikel" ? "z. B. Artikel-Nr. / Bezeichnung" : undefined);

        return (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={name} className="flex items-center gap-1.5 text-xs font-medium">
              {f.label}
              {effReq ? (
                <Badge variant="destructive" className="ml-1 px-1 py-0 text-[10px]">
                  Pflicht
                </Badge>
              ) : null}
            </Label>
            {f.type === "textarea" ? (
              <Textarea
                id={name}
                name={name}
                rows={3}
                placeholder={ph}
                required={false}
                value={values[f.key] ?? ""}
                data-order-form-field=""
                onChange={(e) => setVal(f.key, e.target.value)}
              />
            ) : f.type === "select" && f.options?.length ? (
              <>
                <input type="hidden" name={name} value={values[f.key] ?? ""} />
                <Select
                  value={values[f.key] ?? ""}
                  onValueChange={(v) => setVal(f.key, String(v))}
                >
                  <SelectTrigger data-order-form-field="">
                    <SelectValue placeholder={effReq ? "Bitte wählen…" : "—"} />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : f.type === "number" ? (
              <Input
                id={name}
                name={name}
                type="text"
                inputMode="decimal"
                placeholder={ph}
                required={false}
                value={values[f.key] ?? ""}
                data-order-form-field=""
                onChange={(e) => setVal(f.key, e.target.value)}
                onKeyDown={handleOrderFormEnterKeyNav}
              />
            ) : (
              <Input
                id={name}
                name={name}
                type="text"
                placeholder={ph}
                required={false}
                value={values[f.key] ?? ""}
                data-order-form-field=""
                onChange={(e) => setVal(f.key, e.target.value)}
                onKeyDown={handleOrderFormEnterKeyNav}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

export type OrderFormLineRef = { templateId: string; lineId: string };

export function MonteurOrderFormSections({
  templates,
  lines,
  onToggleTemplate,
  onAddLine,
  onRemoveLine,
}: {
  templates: OrderFormTemplate[];
  lines: OrderFormLineRef[];
  onToggleTemplate: (templateId: string) => void;
  onAddLine: (templateId: string) => void;
  onRemoveLine: (lineId: string) => void;
}) {
  if (templates.length === 0) return null;

  return (
    <div className="space-y-3 border-t border-border pt-4" data-monteur-order-forms="">
      <div className="flex items-start gap-2">
        <ClipboardList className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Bestellformulare</h3>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Vorlage auswählen; bei mehreren gleichen Produkten (z. B. zwei Rolläden) «Weitere Position»
            nutzen. «Pflicht» gilt pro ausgewählter Position (Prüfung beim Speichern).             Einzeilige Felder: <span className="font-medium text-foreground">Enter</span> springt zum nächsten Feld;
            mehrzeilige Texte und Auswahllisten: <span className="font-medium text-foreground">Tab</span>.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {templates.map((tpl) => {
          const linesForTpl = lines.filter((l) => l.templateId === tpl.id);
          const selected = linesForTpl.length > 0;
          const singlePositionOnly = isSinglePositionTemplate(tpl);
          return (
            <Card key={tpl.id} size="sm" className="overflow-hidden border-border shadow-sm">
              <label className="flex cursor-pointer items-start gap-3 p-3 transition-colors hover:bg-muted/30">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleTemplate(tpl.id)}
                  className="mt-1 size-4 shrink-0 rounded border-input accent-primary"
                  aria-label={`${tpl.name} auswählen`}
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
                  {tpl.fields.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Noch keine Felder in dieser Vorlage.</p>
                  ) : (
                    <>
                      <div className="space-y-4">
                        {linesForTpl.map((line, idx) => (
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
                                  onClick={() => onRemoveLine(line.lineId)}
                                >
                                  Entfernen
                                </Button>
                              ) : null}
                            </div>
                            <OrderFormFieldsForTemplate tpl={tpl} lineId={line.lineId} />
                          </div>
                        ))}
                      </div>
                      {!singlePositionOnly ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full gap-1.5 text-xs"
                          data-order-form-field=""
                          onClick={() => onAddLine(tpl.id)}
                        >
                          <Plus className="size-3.5" />
                          Weitere Position ({tpl.name})
                        </Button>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Für Ersatzteile ist nur eine Position erlaubt.
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
