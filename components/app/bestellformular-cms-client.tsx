"use client";

import { memo, useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SupplierOrderFieldDefinition, SupplierOrderTemplate } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteSupplierTemplateAction, saveSupplierTemplateAction } from "@/app/(app)/bestellformular/actions";

type Props = {
  templates: SupplierOrderTemplate[];
  supplierNames?: string[];
};

type TemplateDraft = {
  id?: string;
  supplierId: string;
  supplierName: string;
  name: string;
  fieldDefinitions: SupplierOrderFieldDefinition[];
};

const FIELD_TYPES: Array<SupplierOrderFieldDefinition["type"]> = ["text", "number", "select", "article"];
const FIELD_TYPE_LABEL: Record<SupplierOrderFieldDefinition["type"], string> = {
  text: "Text",
  number: "Zahl",
  select: "Dropdown",
  article: "Artikel",
};

function blankField(index: number): SupplierOrderFieldDefinition {
  return {
    key: `feld_${index + 1}`,
    label: `Feld ${index + 1}`,
    type: "text",
    required: false,
    options: [],
  };
}

function draftFromTemplate(template: SupplierOrderTemplate): TemplateDraft {
  return {
    id: template.id,
    supplierId: template.supplierId,
    supplierName: template.supplierName,
    name: template.name,
    fieldDefinitions: template.fieldDefinitions ?? [],
  };
}

type SupplierFieldRowProps = {
  field: SupplierOrderFieldDefinition;
  index: number;
  total: number;
  conditionTargets: Array<{ key: string; label: string }>;
  onUpdateField: (index: number, patch: Partial<SupplierOrderFieldDefinition>) => void;
  onMoveField: (index: number, direction: -1 | 1) => void;
  onDeleteField: (index: number) => void;
};

const SupplierFieldRow = memo(function SupplierFieldRow({
  field,
  index,
  total,
  conditionTargets,
  onUpdateField,
  onMoveField,
  onDeleteField,
}: SupplierFieldRowProps) {
  const showWhen = field.showWhen?.[0];
  const requireWhen = field.requireWhen?.[0];
  const [showAdvanced, setShowAdvanced] = useState(false);
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.05]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Feld {index + 1}</p>
        <Button type="button" size="sm" variant="ghost" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? "Einfach" : "Erweitert"}
        </Button>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Feldname</Label>
        <Input
          value={field.label}
          onChange={(e) => onUpdateField(index, { label: e.target.value })}
          placeholder="z. B. Storen-Typ"
        />
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
        <div className="space-y-1">
          <Label className="text-xs">Feldtyp</Label>
        <select
          className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
          value={field.type}
          onChange={(e) =>
            onUpdateField(index, { type: e.target.value as SupplierOrderFieldDefinition["type"] })
          }
        >
          {FIELD_TYPES.map((type) => (
            <option key={type} value={type}>
              {FIELD_TYPE_LABEL[type]}
            </option>
          ))}
        </select>
        </div>
        <label className="inline-flex items-center gap-2 rounded-md border px-2 text-xs">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onUpdateField(index, { required: e.target.checked })}
          />
          Pflichtfeld
        </label>
        {showAdvanced ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={index === 0}
              onClick={() => onMoveField(index, -1)}
            >
              Hoch
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={index === total - 1}
              onClick={() => onMoveField(index, 1)}
            >
              Runter
            </Button>
          </>
        ) : null}
      </div>

      {field.type === "select" ? (
        <div className="mt-2 space-y-1">
          <Label className="text-xs">Dropdown-Optionen (eine pro Zeile)</Label>
          <Textarea
            value={(field.options ?? []).join("\n")}
            onChange={(e) => onUpdateField(index, { options: e.target.value.split("\n") })}
            rows={4}
          />
        </div>
      ) : null}

      {showAdvanced ? (
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Anzeigen wenn</Label>
          <select
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
            value={showWhen?.fieldKey ?? ""}
            onChange={(e) => {
              const fieldKey = e.target.value;
              if (!fieldKey) {
                onUpdateField(index, { showWhen: [] });
                return;
              }
              onUpdateField(index, {
                showWhen: [{ fieldKey, operator: showWhen?.operator ?? "equals", value: showWhen?.value ?? "" }],
              });
            }}
          >
            <option value="">Immer anzeigen</option>
            {conditionTargets.map((target) => (
              <option key={target.key} value={target.key}>
                {target.label}
              </option>
            ))}
          </select>
          {showWhen ? (
            <div className="grid grid-cols-[1fr_1fr] gap-2">
              <select
                className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                value={showWhen.operator}
                onChange={(e) =>
                  onUpdateField(index, {
                    showWhen: [{
                      ...showWhen,
                      operator: e.target.value as "equals" | "not_equals",
                    }],
                  })
                }
              >
                <option value="equals">gleich</option>
                <option value="not_equals">ungleich</option>
              </select>
              <Input
                value={showWhen.value}
                onChange={(e) =>
                  onUpdateField(index, {
                    showWhen: [{ ...showWhen, value: e.target.value }],
                  })
                }
                placeholder="Wert"
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Pflicht wenn</Label>
          <select
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
            value={requireWhen?.fieldKey ?? ""}
            onChange={(e) => {
              const fieldKey = e.target.value;
              if (!fieldKey) {
                onUpdateField(index, { requireWhen: [] });
                return;
              }
              onUpdateField(index, {
                requireWhen: [{ fieldKey, operator: requireWhen?.operator ?? "equals", value: requireWhen?.value ?? "" }],
              });
            }}
          >
            <option value="">Nach Basis-Pflichtfeld</option>
            {conditionTargets.map((target) => (
              <option key={target.key} value={target.key}>
                {target.label}
              </option>
            ))}
          </select>
          {requireWhen ? (
            <div className="grid grid-cols-[1fr_1fr] gap-2">
              <select
                className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                value={requireWhen.operator}
                onChange={(e) =>
                  onUpdateField(index, {
                    requireWhen: [{
                      ...requireWhen,
                      operator: e.target.value as "equals" | "not_equals",
                    }],
                  })
                }
              >
                <option value="equals">gleich</option>
                <option value="not_equals">ungleich</option>
              </select>
              <Input
                value={requireWhen.value}
                onChange={(e) =>
                  onUpdateField(index, {
                    requireWhen: [{ ...requireWhen, value: e.target.value }],
                  })
                }
                placeholder="Wert"
              />
            </div>
          ) : null}
        </div>
      </div>
      ) : null}

      <div className="mt-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-red-700"
          onClick={() => onDeleteField(index)}
        >
          Feld löschen
        </Button>
      </div>
    </div>
  );
});

export function BestellformularCmsClient({ templates, supplierNames = [] }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>(templates[0]?.id ?? "");
  const [draft, setDraft] = useState<TemplateDraft>(() =>
    templates[0]
      ? draftFromTemplate(templates[0])
      : {
          supplierId: "",
          supplierName: "",
          name: "",
          fieldDefinitions: [blankField(0)],
        },
  );
  const [newSupplierName, setNewSupplierName] = useState<string>(supplierNames[0] ?? "");
  const [newName, setNewName] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const templateMap = useMemo(
    () => new Map(templates.map((template) => [template.id, template] as const)),
    [templates],
  );
  const editorSupplierOptions = useMemo(() => {
    const list = [...supplierNames];
    if (draft.supplierName && !list.includes(draft.supplierName)) {
      list.push(draft.supplierName);
    }
    return list.sort((a, b) => a.localeCompare(b, "de-CH"));
  }, [supplierNames, draft.supplierName]);
  const conditionTargets = useMemo(
    () =>
      draft.fieldDefinitions.map((field, index) => ({
        key: field.key || `feld_${index + 1}`,
        label: field.label || `Feld ${index + 1}`,
      })),
    [draft.fieldDefinitions],
  );

  const onSelectTemplate = (templateId: string) => {
    setSelectedId(templateId);
    const template = templateMap.get(templateId);
    if (!template) {
      return;
    }
    setDraft(draftFromTemplate(template));
  };

  const onUpdateField = useCallback((index: number, patch: Partial<SupplierOrderFieldDefinition>) => {
    setDraft((prev) => ({
      ...prev,
      fieldDefinitions: prev.fieldDefinitions.map((field, i) =>
        i === index ? { ...field, ...patch } : field,
      ),
    }));
  }, []);

  const onMoveField = useCallback((index: number, direction: -1 | 1) => {
    setDraft((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.fieldDefinitions.length) {
        return prev;
      }
      const next = [...prev.fieldDefinitions];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return { ...prev, fieldDefinitions: next };
    });
  }, []);

  const onDeleteField = useCallback((index: number) => {
    setDraft((prev) => ({
      ...prev,
      fieldDefinitions: prev.fieldDefinitions.filter((_, i) => i !== index),
    }));
  }, []);

  const createNewTemplate = () => {
    const supplierName = newSupplierName.trim();
    if (!supplierName) {
      setFeedback({ type: "error", text: "Bitte zuerst einen Lieferanten auswählen." });
      return;
    }
    const name = newName.trim();
    if (!name) {
      setFeedback({ type: "error", text: "Bitte einen Formularnamen eingeben." });
      return;
    }
    setDraft({
      supplierId: "",
      supplierName,
      name,
      fieldDefinitions: [blankField(0)],
    });
    setSelectedId("");
    setFeedback({ type: "success", text: "Neues Formular erstellt. Jetzt rechts Felder erfassen und speichern." });
  };

  const saveDraft = () => {
    startTransition(async () => {
      try {
        const saved = await saveSupplierTemplateAction(draft);
        if (saved?.id) {
          setSelectedId(saved.id);
          setDraft(draftFromTemplate(saved));
        }
        router.refresh();
        setFeedback({ type: "success", text: "Bestellformular gespeichert." });
      } catch (error) {
        setFeedback({
          type: "error",
          text: error instanceof Error ? error.message : "Bestellformular konnte nicht gespeichert werden.",
        });
      }
    });
  };

  const removeTemplate = () => {
    if (!draft.id) {
      setFeedback({ type: "error", text: "Dieses Formular ist noch nicht gespeichert." });
      return;
    }
    const ok = window.confirm("Bestellformular wirklich löschen?");
    if (!ok) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteSupplierTemplateAction({ templateId: draft.id });
        setSelectedId("");
        setDraft({
          supplierId: "",
          supplierName: supplierNames[0] ?? "",
          name: "",
          fieldDefinitions: [blankField(0)],
        });
        router.refresh();
        setFeedback({ type: "success", text: "Bestellformular gelöscht." });
      } catch (error) {
        setFeedback({
          type: "error",
          text: error instanceof Error ? error.message : "Bestellformular konnte nicht gelöscht werden.",
        });
      }
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>1) Neues Formular starten</CardTitle>
          <CardDescription>Lieferant wählen, Namen vergeben, dann rechts Felder aufbauen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Lieferantenname</Label>
            <select
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
            >
              <option value="">Bitte wählen …</option>
              {supplierNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Formularname</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="z. B. Lamellenstoren"
            />
          </div>
          <Button type="button" className="w-full" onClick={createNewTemplate}>
            Neues Formular erstellen
          </Button>

          <div className="pt-2">
            <Label className="text-xs text-muted-foreground">2) Bestehendes Formular öffnen</Label>
            <div className="mt-2 max-h-80 space-y-1 overflow-auto rounded-md border p-2">
              {templates.length === 0 ? (
                <p className="text-xs text-muted-foreground">Noch keine Formulare vorhanden.</p>
              ) : (
                templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={`w-full rounded px-2 py-1 text-left text-sm ${
                      selectedId === template.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                    }`}
                    onClick={() => onSelectTemplate(template.id)}
                  >
                    {template.supplierName} - {template.name}
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
            Änderungen wirken direkt in Projekten.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3) Formular bearbeiten</CardTitle>
          <CardDescription>Nur das Nötigste: Feldname, Feldtyp und Pflichtfeld. Mehr unter „Erweitert“.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedback ? (
            <div
              className={`rounded-md border px-3 py-2 text-sm ${
                feedback.type === "success"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-amber-300 bg-amber-50 text-amber-900"
              }`}
            >
              {feedback.text}
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Lieferantenname</Label>
              <select
                value={draft.supplierName}
                onChange={(e) => setDraft((prev) => ({ ...prev, supplierName: e.target.value }))}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
              >
                <option value="">Bitte wählen …</option>
                {editorSupplierOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {draft.supplierName && !supplierNames.includes(draft.supplierName) ? (
                <p className="text-xs text-amber-700">
                  Dieser Lieferant ist nicht mehr in Kontakte als Kategorie "Lieferant" vorhanden.
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label>Formularname</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="z. B. Lamellenstoren"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Felder im Formular</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    fieldDefinitions: [...prev.fieldDefinitions, blankField(prev.fieldDefinitions.length)],
                  }))
                }
              >
                Feld hinzufügen
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Tipp: Starten Sie mit den wichtigsten 3-5 Feldern. Zusätzliche Logik nur bei Bedarf über „Erweitert“.
            </p>

            <div className="space-y-2">
              {draft.fieldDefinitions.map((field, index) => (
                <SupplierFieldRow
                  key={`${field.key}-${index}`}
                  field={field}
                  index={index}
                  total={draft.fieldDefinitions.length}
                  conditionTargets={conditionTargets.filter((t) => t.key !== (field.key || `feld_${index + 1}`))}
                  onUpdateField={onUpdateField}
                  onMoveField={onMoveField}
                  onDeleteField={onDeleteField}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={saveDraft} disabled={isPending}>
              Änderungen speichern
            </Button>
            <Button type="button" variant="outline" onClick={removeTemplate} disabled={isPending || !draft.id}>
              Formular löschen
            </Button>
          </div>

          <div className="rounded-md border bg-muted/20 p-3">
            <p className="mb-2 text-sm font-medium">Kurzübersicht</p>
            <div className="space-y-1 text-sm">
              {draft.fieldDefinitions.map((f, i) => (
                <p key={`preview-${f.key}-${i}`}>
                  {f.label}
                  {f.required ? " *" : ""} ·{" "}
                  <span className="text-muted-foreground">{FIELD_TYPE_LABEL[f.type]}</span>
                </p>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
