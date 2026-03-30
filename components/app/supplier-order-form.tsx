"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitSupplierTemplateAction } from "@/app/(app)/actions";
import type { Article, SupplierOrderFieldDefinition, SupplierOrderTemplate } from "@/lib/domain/types";
import {
  getRequiredSupplierFieldKeys,
  getVisibleSupplierFields,
  isSupplierFieldRequired,
} from "@/lib/forms/supplier-conditions";

type SupplierOrderFormProps = {
  projectId: string;
  template: SupplierOrderTemplate;
  articleOptions?: Article[];
  /** If true the form is in "draft/technician" mode (save, not send) */
  draftMode?: boolean;
  onSubmitted?: () => void;
};

function FieldInput({
  def,
  value,
  onChange,
  hasError,
  articleOptions,
}: {
  def: SupplierOrderFieldDefinition;
  value: string;
  onChange: (v: string) => void;
  hasError: boolean;
  articleOptions: Article[];
}) {
  const baseSelect =
    "h-9 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus:ring-1 focus:ring-ring";
  const errBorder = hasError ? "border-destructive" : "border-input";

  switch (def.type) {
    case "select":
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${baseSelect} ${errBorder}`}
        >
          <option value="">Bitte wählen …</option>
          {(def.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    case "article":
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${baseSelect} ${errBorder}`}
        >
          <option value="">Artikel wählen …</option>
          {articleOptions.map((a) => (
            <option key={a.id} value={a.name}>
              {a.name}
              {a.sku ? ` (${a.sku})` : ""}
            </option>
          ))}
        </select>
      );
    case "number":
      return (
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={hasError ? "border-destructive" : ""}
          placeholder={def.placeholder}
        />
      );
    default:
      return (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={hasError ? "border-destructive" : ""}
          placeholder={def.placeholder}
        />
      );
  }
}

export function SupplierOrderForm({
  projectId,
  template,
  articleOptions = [],
  draftMode = false,
  onSubmitted,
}: SupplierOrderFormProps) {
  const fields: SupplierOrderFieldDefinition[] = template.fieldDefinitions ?? [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [orderTitle, setOrderTitle] = useState(template.name);
  const visibleFields = getVisibleSupplierFields(fields, values);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requiredKeys = new Set(getRequiredSupplierFieldKeys(fields, values));
    const nextMissing = visibleFields
      .filter((f) => requiredKeys.has(f.key) && !values[f.key]?.trim())
      .map((f) => f.label);
    setMissing(nextMissing);
    if (nextMissing.length > 0) {
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("projectId", projectId);
        formData.set("templateId", template.id);
        formData.set(
          "valuesJson",
          JSON.stringify({ titel: orderTitle.trim(), ...values }),
        );
        if (draftMode) {
          formData.set("draftOnly", "1");
        }
        await submitSupplierTemplateAction(formData);
        window.alert(
          draftMode
            ? "Bestellformular als Entwurf gespeichert."
            : "Bestellformular wurde eingereicht und per E-Mail versendet.",
        );
        onSubmitted?.();
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message : "Bestellformular konnte nicht gespeichert werden.",
        );
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-md border p-4">
      {/* Title */}
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${template.id}-titel`}>Titel</Label>
        <Input
          id={`${template.id}-titel`}
          value={orderTitle}
          onChange={(e) => setOrderTitle(e.target.value)}
          placeholder="z. B. Stoff Nachbestellung Balkon Süd"
        />
      </div>

      {/* Dynamic fields from fieldDefinitions */}
      {visibleFields.map((def) => (
        <div key={def.key} className="flex flex-col gap-1">
          <Label htmlFor={`${template.id}-${def.key}`}>
            {def.label}
            {isSupplierFieldRequired(def, values) ? " *" : ""}
          </Label>
          {def.helpText ? (
            <p className="text-xs text-muted-foreground">{def.helpText}</p>
          ) : null}
          <FieldInput
            def={def}
            value={values[def.key] ?? ""}
            onChange={(v) => setValues((prev) => ({ ...prev, [def.key]: v }))}
            hasError={missing.includes(def.label)}
            articleOptions={articleOptions}
          />
        </div>
      ))}

      {/* Validation hint */}
      {missing.length > 0 ? (
        <p className="text-xs text-destructive">
          Pflichtfelder fehlen: {missing.join(", ")}
        </p>
      ) : null}

      {/* Submit */}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? (
          <BauflipLoadingButtonLabel variant="onPrimary">
            Wird gespeichert…
          </BauflipLoadingButtonLabel>
        ) : draftMode ? (
          "Entwurf speichern"
        ) : (
          "Bestellformular absenden"
        )}
      </Button>
    </form>
  );
}
