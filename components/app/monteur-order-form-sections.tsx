"use client";

import { useMemo, useState } from "react";
import type { OrderFormTemplate } from "@/lib/domain/types";
import {
  computeOrderFormVisibilityMask,
  isOrderFormFieldEffectivelyRequired,
} from "@/lib/order-forms/field-runtime";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList } from "lucide-react";

function OrderFormFieldsForTemplate({ tpl }: { tpl: OrderFormTemplate }) {
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
        const name = `orderForm__${tpl.id}__${f.key}`;
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
                required={effReq}
                value={values[f.key] ?? ""}
                onChange={(e) => setVal(f.key, e.target.value)}
              />
            ) : f.type === "select" && f.options?.length ? (
              <>
                <input type="hidden" name={name} value={values[f.key] ?? ""} />
                <Select
                  value={values[f.key] ?? ""}
                  onValueChange={(v) => setVal(f.key, String(v))}
                >
                  <SelectTrigger>
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
                required={effReq}
                value={values[f.key] ?? ""}
                onChange={(e) => setVal(f.key, e.target.value)}
              />
            ) : (
              <Input
                id={name}
                name={name}
                type="text"
                placeholder={ph}
                required={effReq}
                value={values[f.key] ?? ""}
                onChange={(e) => setVal(f.key, e.target.value)}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

export function MonteurOrderFormSections({ templates }: { templates: OrderFormTemplate[] }) {
  if (templates.length === 0) return null;

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="size-4 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Bestellformulare</h3>
          <p className="text-[11px] text-muted-foreground">
            Vom Administrator definiert.
          </p>
        </div>
      </div>
      {templates.map((tpl) => (
        <Card key={tpl.id} size="sm" className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              {tpl.supplierName?.trim() ? (
                <Badge variant="outline" className="text-[10px]">
                  {tpl.supplierName.trim()}
                </Badge>
              ) : null}
              <CardTitle className="text-sm">{tpl.name}</CardTitle>
            </div>
            {tpl.description ? (
              <p className="text-xs text-muted-foreground">{tpl.description}</p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {tpl.fields.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Noch keine Felder in dieser Vorlage.
              </p>
            ) : (
              <OrderFormFieldsForTemplate tpl={tpl} />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
