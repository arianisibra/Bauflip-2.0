"use client";

import { useCallback, useMemo, useState } from "react";
import {
  useCreateOrderFormTemplate,
  useDeleteOrderFormTemplate,
  useOrderFormTemplates,
  useUpdateOrderFormTemplate,
} from "@/lib/query/hooks";
import { toast } from "sonner";
import type { OrderFormTemplate } from "@/lib/domain/types";
import type { OrderFormFieldDef } from "@/lib/order-forms/schema";
import { orderFormFieldsSchema, slugifyOrderFormSlug } from "@/lib/order-forms/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  AlignLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  FilePlus2,
  Hash,
  LayoutList,
  MousePointerClick,
  Package,
  Plus,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Type,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIELD_TYPE_OPTIONS: { value: OrderFormFieldDef["type"]; label: string; icon: typeof Type }[] = [
  { value: "text", label: "Text", icon: Type },
  { value: "number", label: "Zahl", icon: Hash },
  { value: "select", label: "Dropdown", icon: ChevronDown },
  { value: "artikel", label: "Artikel", icon: Package },
  { value: "textarea", label: "Mehrzeilig", icon: AlignLeft },
];

const SHOW_WHEN_OPTIONS: { value: "always" | "when_field_equals"; label: string }[] = [
  { value: "always", label: "Immer anzeigen" },
  { value: "when_field_equals", label: "Wenn anderes Feld …" },
];

function showWhenLabel(v: string): string {
  return SHOW_WHEN_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

const REQUIRE_WHEN_OPTIONS: {
  value: "when_marked_required" | "after_base_required";
  label: string;
}[] = [
  { value: "when_marked_required", label: "Wenn als Pflicht markiert" },
  { value: "after_base_required", label: "Nach Basis-Pflichtfeld" },
];

function requireWhenLabel(v: string): string {
  return REQUIRE_WHEN_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

function typeLabel(t: OrderFormFieldDef["type"]): string {
  return FIELD_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

function typeIcon(t: OrderFormFieldDef["type"]) {
  return FIELD_TYPE_OPTIONS.find((o) => o.value === t)?.icon ?? Type;
}

// ---------------------------------------------------------------------------
// UiField helpers (unchanged logic, new extended fields)
// ---------------------------------------------------------------------------

type UiField = {
  localId: string;
  key: string;
  label: string;
  type: OrderFormFieldDef["type"];
  required: boolean;
  placeholder: string;
  optionsLines: string;
  showWhen: "always" | "when_field_equals";
  showWhenFieldKey: string;
  showWhenValue: string;
  requireWhen: "when_marked_required" | "after_base_required";
};

function randomLocalId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `f-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function templateToUiFields(fields: OrderFormFieldDef[]): UiField[] {
  return fields.map((f) => ({
    localId: randomLocalId(),
    key: f.key,
    label: f.label,
    type: f.type,
    required: Boolean(f.required),
    placeholder: f.placeholder ?? "",
    optionsLines: (f.options ?? []).join("\n"),
    showWhen: f.showWhen === "when_field_equals" ? "when_field_equals" : "always",
    showWhenFieldKey: f.showWhenFieldKey ?? "",
    showWhenValue: f.showWhenValue ?? "",
    requireWhen: f.requireWhen === "after_base_required" ? "after_base_required" : "when_marked_required",
  }));
}

function nextKeyFromLabel(label: string, used: Set<string>): string {
  let base = slugifyOrderFormSlug(label.trim() || "feld").replace(/-/g, "_");
  if (!base || !/^[a-z]/i.test(base)) base = "feld";
  let key = base;
  let n = 2;
  while (used.has(key)) {
    key = `${base}_${n++}`;
  }
  return key;
}

function uiFieldsToDefs(fields: UiField[]): OrderFormFieldDef[] {
  return fields.map((f) => {
    const opts =
      f.type === "select"
        ? f.optionsLines
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
        : undefined;
    const def: OrderFormFieldDef = {
      key: f.key.trim(),
      label: f.label.trim(),
      type: f.type,
      required: f.required,
      ...(f.placeholder.trim() ? { placeholder: f.placeholder.trim() } : {}),
      ...(opts?.length ? { options: opts } : {}),
    };
    if (f.showWhen === "when_field_equals") {
      def.showWhen = "when_field_equals";
      def.showWhenFieldKey = f.showWhenFieldKey.trim();
      def.showWhenValue = f.showWhenValue.trim();
    }
    if (f.requireWhen === "after_base_required") {
      def.requireWhen = "after_base_required";
    }
    return def;
  });
}

// ---------------------------------------------------------------------------
// Field Card
// ---------------------------------------------------------------------------

function OrderFormCmsFieldCard({
  f,
  index,
  total,
  allFields,
  onPatch,
  onRemove,
  onMove,
}: {
  f: UiField;
  index: number;
  total: number;
  allFields: UiField[];
  onPatch: (localId: string, patch: Partial<UiField>) => void;
  onRemove: (localId: string) => void;
  onMove: (index: number, dir: -1 | 1) => void;
}) {
  const [extended, setExtended] = useState(false);
  const refOptions = allFields
    .filter((_, i) => i !== index)
    .map((x) => ({ key: x.key.trim(), label: x.label.trim() }))
    .filter((s) => s.key.length > 0);

  const TypeIcon = typeIcon(f.type);

  return (
    <li className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm ring-1 ring-black/[0.03] transition-shadow hover:shadow-md dark:ring-white/[0.06]">
      <div className="p-4">
        {/* -- Header row -- */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-semibold uppercase tracking-wide">
            Feld {index + 1}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <TypeIcon className="size-3" />
            {typeLabel(f.type)}
          </Badge>
          {f.required ? (
            <Badge
              variant="outline"
              className="border-emerald-500/25 bg-emerald-500/10 font-medium text-emerald-800 dark:text-emerald-200"
            >
              Pflicht
            </Badge>
          ) : null}

          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              size="icon-xs"
              variant="outline"
              disabled={index <= 0}
              onClick={() => onMove(index, -1)}
              aria-label="Nach oben"
            >
              <ChevronUp className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant="outline"
              disabled={index >= total - 1}
              onClick={() => onMove(index, 1)}
              aria-label="Nach unten"
            >
              <ChevronDown className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="ml-1 gap-1 text-muted-foreground"
              onClick={() => setExtended((v) => !v)}
            >
              <SlidersHorizontal className="size-3" />
              {extended ? "Einfach" : "Erweitert"}
            </Button>
          </div>
        </div>

        {/* -- Feldname -- */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Feldname</Label>
          <Input
            value={f.label}
            onChange={(e) => onPatch(f.localId, { label: e.target.value })}
            placeholder={`Feld ${index + 1}`}
          />
        </div>

        {/* -- Type + Required row -- */}
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] flex-1 space-y-1.5">
            <Label className="text-xs font-medium">Feldtyp</Label>
            <Select
              value={f.type}
              onValueChange={(v) => onPatch(f.localId, { type: v as OrderFormFieldDef["type"] })}
            >
              <SelectTrigger>
                <SelectValue resolvedLabel={typeLabel(f.type)} />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPE_OPTIONS.map((o) => {
                  const Icon = o.icon;
                  return (
                    <SelectItem key={o.value} value={o.value}>
                      <Icon className="size-3.5 text-muted-foreground" />
                      {o.label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-sm transition-colors hover:bg-muted/30">
            <input
              type="checkbox"
              className="accent-primary"
              checked={f.required}
              onChange={(e) => onPatch(f.localId, { required: e.target.checked })}
            />
            Pflichtfeld
          </label>
        </div>
      </div>

      {/* -- Extended panel -- */}
      {extended ? (
        <div className="space-y-3 border-t border-border/60 bg-muted/10 px-4 pb-4 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Anzeigen wenn</Label>
              <Select
                value={f.showWhen}
                onValueChange={(v) => {
                  if (v === "always") {
                    onPatch(f.localId, { showWhen: "always", showWhenFieldKey: "", showWhenValue: "" });
                  } else {
                    onPatch(f.localId, { showWhen: "when_field_equals" });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue resolvedLabel={showWhenLabel(f.showWhen)} />
                </SelectTrigger>
                <SelectContent>
                  {SHOW_WHEN_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Pflicht wenn</Label>
              <Select
                value={f.requireWhen}
                onValueChange={(v) =>
                  onPatch(f.localId, { requireWhen: v as UiField["requireWhen"] })
                }
              >
                <SelectTrigger>
                  <SelectValue resolvedLabel={requireWhenLabel(f.requireWhen)} />
                </SelectTrigger>
                <SelectContent>
                  {REQUIRE_WHEN_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {f.showWhen === "when_field_equals" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Referenz-Feld</Label>
                <Select
                  value={f.showWhenFieldKey || "__none__"}
                  onValueChange={(v) =>
                    onPatch(f.localId, { showWhenFieldKey: v === "__none__" ? "" : String(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      resolvedLabel={
                        f.showWhenFieldKey
                          ? (refOptions.find((s) => s.key === f.showWhenFieldKey)?.label || f.showWhenFieldKey)
                          : ""
                      }
                      placeholder="— Feld wählen —"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Feld wählen —</SelectItem>
                    {refOptions.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label || s.key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Wert (exakt)</Label>
                <Input
                  className="font-mono text-xs"
                  value={f.showWhenValue}
                  onChange={(e) => onPatch(f.localId, { showWhenValue: e.target.value })}
                  placeholder="z. B. Ja"
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Platzhalter-Text</Label>
            <Input
              value={f.placeholder}
              onChange={(e) => onPatch(f.localId, { placeholder: e.target.value })}
              placeholder="z. B. Bitte eingeben…"
            />
          </div>

          {f.type === "select" ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Dropdown-Optionen (eine pro Zeile)</Label>
              <Textarea
                rows={4}
                className="font-mono text-xs"
                value={f.optionsLines}
                onChange={(e) => onPatch(f.localId, { optionsLines: e.target.value })}
              />
            </div>
          ) : null}

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              size="xs"
              variant="destructive"
              className="gap-1"
              onClick={() => onRemove(f.localId)}
            >
              <Trash2 className="size-3" />
              Feld löschen
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Form Editor (right column)
// ---------------------------------------------------------------------------

function CmsFormEditor({
  template,
  onDeleted,
}: {
  template: OrderFormTemplate;
  onDeleted: () => void;
}) {
  const updateTpl = useUpdateOrderFormTemplate();
  const deleteTpl = useDeleteOrderFormTemplate();
  const pending = updateTpl.isPending || deleteTpl.isPending;
  const [error, setError] = useState<string | null>(null);

  const [supplierName, setSupplierName] = useState(template.supplierName ?? "");
  const [formName, setFormName] = useState(template.name);
  const [sortOrder, setSortOrder] = useState(String(template.sortOrder));
  const [isActive, setIsActive] = useState(template.isActive);
  const [fields, setFields] = useState<UiField[]>(() => templateToUiFields(template.fields));

  const addField = useCallback(() => {
    setFields((prev) => {
      const used = new Set(prev.map((p) => p.key));
      const label = "Neues Feld";
      const key = nextKeyFromLabel(label, used);
      return [
        ...prev,
        {
          localId: randomLocalId(),
          key,
          label,
          type: "text" as const,
          required: false,
          placeholder: "",
          optionsLines: "",
          showWhen: "always" as const,
          showWhenFieldKey: "",
          showWhenValue: "",
          requireWhen: "when_marked_required" as const,
        },
      ];
    });
  }, []);

  const removeField = useCallback((localId: string) => {
    setFields((prev) => prev.filter((f) => f.localId !== localId));
  }, []);

  const updateField = useCallback((localId: string, patch: Partial<UiField>) => {
    setFields((prev) => {
      const updated = prev.map((f) => (f.localId !== localId ? f : { ...f, ...patch }));
      if (patch.label !== undefined) {
        const idx = updated.findIndex((f) => f.localId === localId);
        if (idx !== -1) {
          const used = new Set(updated.filter((_, i) => i !== idx).map((f) => f.key));
          updated[idx] = { ...updated[idx], key: nextKeyFromLabel(patch.label, used) };
        }
      }
      return updated;
    });
  }, []);

  const moveField = useCallback((index: number, dir: -1 | 1) => {
    setFields((prev) => {
      const next = index + dir;
      if (next < 0 || next >= prev.length) return prev;
      const cp = [...prev];
      [cp[index], cp[next]] = [cp[next], cp[index]];
      return cp;
    });
  }, []);

  const handleSave = async () => {
    setError(null);
    const defs = uiFieldsToDefs(fields);
    const parsed = orderFormFieldsSchema.safeParse(defs);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Felder ungültig.");
      return;
    }
    const sortNum = Number(sortOrder) || 0;
    try {
      await updateTpl.mutateAsync({
        templateId: template.id,
        payload: {
          supplierName,
          name: formName.trim(),
          description: template.description ?? "",
          sortOrder: sortNum,
          isActive,
          fields: parsed.data,
        },
      });
      toast.success("Formular gespeichert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  };

  const handleDeleteForm = async () => {
    if (!window.confirm(`Formular „${formName}" wirklich löschen?`)) return;
    try {
      await deleteTpl.mutateAsync(template.id);
      toast.success("Formular gelöscht");
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    }
  };

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
      <CardHeader className="border-b border-border/50 bg-muted/25">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Settings2 className="size-4" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold tracking-tight">Formular bearbeiten</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Felder, Typ und Pflicht setzen. Änderungen gelten für künftige Rapporte.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        {/* Metadata */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-supplier" className="text-xs font-medium">
              Lieferantenname
            </Label>
            <Input
              id="edit-supplier"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="z. B. Lieferant AG"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-name" className="text-xs font-medium">
              Formularname
            </Label>
            <Input
              id="edit-name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="z. B. Lamellenstoren"
              required
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-sort" className="text-xs font-medium">
              Sortierung
            </Label>
            <Input
              id="edit-sort"
              className="w-24"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-sm transition-colors hover:bg-muted/30">
            <input
              type="checkbox"
              className="accent-primary"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Aktiv
          </label>
        </div>

        {/* Fields section */}
        <div className="border-t border-border/60 pt-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold tracking-tight">Felder im Formular</h3>
            <Button type="button" size="sm" variant="outline" className="gap-1" onClick={addField}>
              <Plus className="size-3.5" />
              Feld hinzufügen
            </Button>
          </div>

          {fields.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-muted/30 text-muted-foreground">
                <LayoutList className="size-6" />
              </div>
              <div className="max-w-xs space-y-1">
                <p className="text-sm font-medium text-foreground">Noch keine Felder</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Fügen Sie Felder hinzu, die im Monteur-Rapport angezeigt werden.
                </p>
              </div>
              <Button type="button" size="sm" className="mt-1 gap-1" onClick={addField}>
                <Plus className="size-3.5" />
                Erstes Feld hinzufügen
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {fields.map((f, index) => (
                <OrderFormCmsFieldCard
                  key={f.localId}
                  f={f}
                  index={index}
                  total={fields.length}
                  allFields={fields}
                  onPatch={updateField}
                  onRemove={removeField}
                  onMove={moveField}
                />
              ))}
            </ul>
          )}
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="flex-wrap gap-3">
        <Button type="button" onClick={handleSave} disabled={pending}>
          {pending ? "Speichern…" : "Änderungen speichern"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto gap-1 text-muted-foreground hover:text-destructive"
          onClick={handleDeleteForm}
          disabled={pending}
        >
          <Trash2 className="size-3.5" />
          Formular löschen
        </Button>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function OrderFormTemplatesAdmin({ templates: initialTemplates }: { templates: OrderFormTemplate[] }) {
  const { data: templates = initialTemplates } = useOrderFormTemplates(initialTemplates);
  const createTpl = useCreateOrderFormTemplate();
  const createPending = createTpl.isPending;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newSupplier, setNewSupplier] = useState("");
  const [newFormName, setNewFormName] = useState("");

  const supplierSuggestions = useMemo(() => {
    const s = new Set<string>();
    for (const t of templates) {
      const v = t.supplierName?.trim();
      if (v) s.add(v);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "de-CH"));
  }, [templates]);

  const selected = selectedId ? templates.find((t) => t.id === selectedId) : undefined;

  const handleCreate = async () => {
    setCreateError(null);
    const name = newFormName.trim();
    if (name.length < 2) {
      setCreateError("Bitte Formularname angeben (min. 2 Zeichen).");
      return;
    }
    try {
      const { id } = await createTpl.mutateAsync({
        supplierName: newSupplier,
        name,
        sortOrder: 0,
        isActive: true,
        fields: [],
      });
      setNewFormName("");
      setNewSupplier("");
      setSelectedId(id);
      toast.success("Formular erstellt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Anlegen fehlgeschlagen.");
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* ---- Sidebar ---- */}
      <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-20 lg:max-w-xs">
        {/* Create new */}
        <Card size="sm" className="overflow-hidden border-border/60 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
          <CardHeader className="border-b border-border/50 bg-muted/25 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <FilePlus2 className="size-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold tracking-tight">Neues Formular</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Lieferant und Name eingeben.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="cms-new-supplier" className="text-xs font-medium">
                Lieferantenname
              </Label>
              <Input
                id="cms-new-supplier"
                list="cms-supplier-datalist"
                value={newSupplier}
                onChange={(e) => setNewSupplier(e.target.value)}
                placeholder="Aus Liste oder frei eingeben"
              />
              <datalist id="cms-supplier-datalist">
                {supplierSuggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cms-new-name" className="text-xs font-medium">
                Formularname
              </Label>
              <Input
                id="cms-new-name"
                value={newFormName}
                onChange={(e) => setNewFormName(e.target.value)}
                placeholder="z. B. Lamellenstoren"
              />
            </div>
          </CardContent>
          <CardFooter className="border-t border-border/50 bg-card px-3 py-3">
            <Button type="button" className="w-full" size="sm" onClick={handleCreate} disabled={createPending}>
              {createPending ? "Wird erstellt…" : "Formular erstellen"}
            </Button>
          </CardFooter>
          {createError ? (
            <div className="border-t border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {createError}
            </div>
          ) : null}
        </Card>

        {/* Template list */}
        <Card size="sm" className="overflow-hidden border-border/60 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
          <CardHeader className="border-b border-border/50 bg-muted/25 pb-3">
            <CardTitle className="text-sm font-semibold tracking-tight">Formulare</CardTitle>
            <CardAction>
              <Badge variant="secondary">{templates.length}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-0">
            <ul className="max-h-[min(50vh,420px)] divide-y divide-border/40 overflow-y-auto">
              {templates.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Noch keine Formulare vorhanden.
                </li>
              ) : (
                templates.map((t) => {
                  const active = selectedId === t.id;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        className={cn(
                          "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors",
                          active
                            ? "bg-primary/8 ring-1 ring-inset ring-primary/25"
                            : "hover:bg-muted/40",
                        )}
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground ring-1 ring-border/60">
                          <FileText className="size-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "truncate text-sm",
                              active ? "font-medium text-foreground" : "text-foreground",
                            )}
                          >
                            {t.name}
                          </p>
                          {t.supplierName?.trim() ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {t.supplierName.trim()}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                          {t.isActive ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                            >
                              aktiv
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100"
                            >
                              inaktiv
                            </Badge>
                          )}
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {t.fields?.length ?? 0} Felder
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </CardContent>
          <CardFooter className="py-2.5">
            <p className="text-[11px] leading-snug text-muted-foreground">
              Aktive Vorlagen erscheinen im Monteur-Rapport.
            </p>
          </CardFooter>
        </Card>
      </aside>

      {/* ---- Main area ---- */}
      <main className="min-w-0 flex-1">
        {selected ? (
          <CmsFormEditor key={selected.id} template={selected} onDeleted={() => setSelectedId(null)} />
        ) : (
          <div className="flex min-h-[min(60vh,480px)] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 bg-gradient-to-br from-muted/10 to-muted/5 p-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/30 text-muted-foreground">
              <MousePointerClick className="size-7" />
            </div>
            <div className="max-w-md space-y-1">
              <p className="text-sm font-medium text-foreground">Kein Formular ausgewählt</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Wählen Sie links ein bestehendes Formular aus oder legen Sie ein neues an.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
