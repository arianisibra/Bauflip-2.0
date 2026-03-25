"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitSupplierTemplateAction } from "@/app/(app)/actions";
import type { SupplierOrderTemplate } from "@/lib/domain/types";

type SupplierOrderFormProps = {
  projectId: string;
  template: SupplierOrderTemplate;
  onSubmitted?: () => void;
};

export function SupplierOrderForm({ projectId, template, onSubmitted }: SupplierOrderFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const requiredFields = template.requiredFields ?? [];

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextMissing = requiredFields.filter((field) => !values[field]?.trim());
    setMissing(nextMissing);
    if (nextMissing.length > 0) {
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("templateId", template.id);
      formData.set("valuesJson", JSON.stringify(values));
      await submitSupplierTemplateAction(formData);
      onSubmitted?.();
    });
  };

  return (
    <form onSubmit={onSubmit} className="rounded-md border p-3">
      <p className="mb-2 text-sm font-medium">{template.supplierName} · {template.name}</p>
      {requiredFields.map((field) => (
        <div key={field} className="mb-2 flex flex-col gap-1">
          <Label htmlFor={`${template.id}-${field}`}>{field} *</Label>
          <Input
            id={`${template.id}-${field}`}
            value={values[field] ?? ""}
            onChange={(event) =>
              setValues((current) => ({ ...current, [field]: event.target.value }))
            }
            className={missing.includes(field) ? "border-destructive" : ""}
          />
        </div>
      ))}
      {missing.length > 0 ? (
        <p className="mb-2 text-xs text-destructive">
          Pflichtfelder fehlen: {missing.join(", ")}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? (
          <BauflipLoadingButtonLabel variant="onPrimary">Wird gespeichert…</BauflipLoadingButtonLabel>
        ) : (
          "Bestellformular abschliessen"
        )}
      </Button>
    </form>
  );
}
