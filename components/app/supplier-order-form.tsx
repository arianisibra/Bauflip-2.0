"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitSupplierTemplateAction } from "@/app/(app)/actions";
import type { SupplierOrderTemplate } from "@/lib/domain/types";

type SupplierOrderFormProps = {
  projectId: string;
  template: SupplierOrderTemplate;
};

export function SupplierOrderForm({ projectId, template }: SupplierOrderFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextMissing = template.requiredFields.filter((field) => !values[field]?.trim());
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
    });
  };

  return (
    <form onSubmit={onSubmit} className="rounded-md border p-3">
      <p className="mb-2 text-sm font-medium">{template.supplierName} · {template.name}</p>
      {template.requiredFields.map((field) => (
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
        {isPending ? "Wird gespeichert..." : "Bestellformular abschliessen"}
      </Button>
    </form>
  );
}
