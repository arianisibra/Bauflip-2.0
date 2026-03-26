"use client";

import { useEffect, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitSupplierTemplateAction } from "@/app/(app)/actions";
import type { Article, SupplierOrderTemplate } from "@/lib/domain/types";

type SupplierOrderFormProps = {
  projectId: string;
  template: SupplierOrderTemplate;
  articleOptions?: Article[];
  onSubmitted?: () => void;
};

function isArticleField(fieldName: string) {
  const n = fieldName.toLowerCase();
  return n.includes("artikel") || n.includes("article");
}

export function SupplierOrderForm({ projectId, template, articleOptions = [], onSubmitted }: SupplierOrderFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [orderTitle, setOrderTitle] = useState(template.name);

  const requiredFields = template.requiredFields ?? [];

  useEffect(() => {
    setOrderTitle(template.name);
    setValues({});
    setMissing([]);
  }, [template.id, template.name]);

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
      formData.set("valuesJson", JSON.stringify({ titel: orderTitle.trim(), ...values }));
      await submitSupplierTemplateAction(formData);
      onSubmitted?.();
    });
  };

  return (
    <form onSubmit={onSubmit} className="rounded-md border p-3">
      <div className="mb-3 flex flex-col gap-1">
        <Label htmlFor={`${template.id}-titel`}>Titel</Label>
        <Input
          id={`${template.id}-titel`}
          value={orderTitle}
          onChange={(event) => setOrderTitle(event.target.value)}
          placeholder="z. B. Stoff Nachbestellung Balkon Süd"
        />
      </div>
      {requiredFields.map((field) => (
        <div key={field} className="mb-2 flex flex-col gap-1">
          <Label htmlFor={`${template.id}-${field}`}>{field} *</Label>
          {isArticleField(field) ? (
            <select
              id={`${template.id}-${field}`}
              value={values[field] ?? ""}
              onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
              className={`h-9 rounded-lg border bg-transparent px-2.5 text-sm outline-none ${
                missing.includes(field) ? "border-destructive" : "border-input"
              }`}
            >
              <option value="">Artikel wählen …</option>
              {articleOptions.map((article) => (
                <option key={article.id} value={article.name}>
                  {article.name}
                  {article.sku ? ` (${article.sku})` : ""}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id={`${template.id}-${field}`}
              value={values[field] ?? ""}
              onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
              className={missing.includes(field) ? "border-destructive" : ""}
            />
          )}
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
