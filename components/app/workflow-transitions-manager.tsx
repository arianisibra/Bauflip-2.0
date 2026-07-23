"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { WorkflowTransition } from "@/lib/domain/workflow-types";
import { workflowTransitionInputSchema } from "@/lib/validations/forms";
import {
  useCreateWorkflowTransition,
  useDeleteWorkflowTransition,
  useUpdateWorkflowTransition,
  useWorkflowStages,
  useWorkflowTransitions,
} from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingsRow } from "@/components/app/settings-row";

type FormState = {
  /** null = neuer Übergang. */
  id: string | null;
  fromKey: string;
  toKey: string;
  actionLabel: string;
  sortOrder: string;
};

const EMPTY_FORM: FormState = { id: null, fromKey: "", toKey: "", actionLabel: "", sortOrder: "0" };

/** Workflow-Übergänge (Pipeline-Knöpfe, Einstellungen, nur Admin): Zeile + Verwalten-Fenster mit Liste + Add/Edit. */
export function WorkflowTransitionsManager() {
  const stagesQuery = useWorkflowStages();
  const transitionsQuery = useWorkflowTransitions();
  const createTransition = useCreateWorkflowTransition();
  const updateTransition = useUpdateWorkflowTransition();
  const deleteTransition = useDeleteWorkflowTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);

  const stages = [...(stagesQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const stageLabel = (key: string) => stages.find((s) => s.key === key)?.label ?? key;

  const transitions = [...(transitionsQuery.data ?? [])].sort((a, b) => {
    if (a.fromKey !== b.fromKey) return a.fromKey.localeCompare(b.fromKey);
    return a.sortOrder - b.sortOrder;
  });

  const pending = createTransition.isPending || updateTransition.isPending;

  const submit = async () => {
    if (!form) return;
    const sortOrder = Number.parseInt(form.sortOrder, 10);
    const payload = {
      fromKey: form.fromKey,
      toKey: form.toKey,
      actionLabel: form.actionLabel,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    };
    const parsed = workflowTransitionInputSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
      return;
    }
    try {
      if (form.id) {
        await updateTransition.mutateAsync({ transitionId: form.id, values: parsed.data });
        toast.success("Übergang aktualisiert");
      } else {
        await createTransition.mutateAsync(parsed.data);
        toast.success("Übergang erstellt");
      }
      setForm(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  };

  const summary = transitionsQuery.isLoading
    ? "Wird geladen …"
    : transitions.length === 0
      ? "Noch nicht konfiguriert — es gelten die Standard-Knöpfe."
      : `${transitions.length} Übergänge`;

  return (
    <>
      <SettingsRow
        title="Workflow-Übergänge"
        summary={summary}
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            Verwalten
          </Button>
        }
      />

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setForm(null);
        }}
        title="Workflow-Übergänge"
        description="Welcher Pipeline-Knopf im Projekt-Sheet von welchem Status zu welchem führt."
        className="max-w-lg"
        footer={
          <div className="flex items-center justify-between gap-2">
            {!form ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...EMPTY_FORM })}>
                <Plus className="size-4" aria-hidden />
                Übergang hinzufügen
              </Button>
            ) : (
              <span />
            )}
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Schliessen
            </Button>
          </div>
        }
      >
        {transitionsQuery.isLoading ? <p className="text-sm text-muted-foreground">Wird geladen …</p> : null}
        {!transitionsQuery.isLoading && transitions.length === 0 && !form ? (
          <p className="text-sm text-muted-foreground">Noch keine Übergänge erfasst.</p>
        ) : null}

        <ul className="divide-y divide-border">
          {transitions.map((t: WorkflowTransition) => (
            <li key={t.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm">
                  {stageLabel(t.fromKey)} → {stageLabel(t.toKey)}
                </p>
                <p className="text-[11px] text-muted-foreground">«{t.actionLabel}»</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Bearbeiten"
                  onClick={() =>
                    setForm({
                      id: t.id,
                      fromKey: t.fromKey,
                      toKey: t.toKey,
                      actionLabel: t.actionLabel,
                      sortOrder: String(t.sortOrder),
                    })
                  }
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  aria-label="Löschen"
                  disabled={deleteTransition.isPending}
                  onClick={async () => {
                    try {
                      await deleteTransition.mutateAsync(t.id);
                      toast.success("Übergang gelöscht");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
                    }
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {form ? (
          <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-[11px] font-medium text-foreground">
              {form.id ? "Übergang bearbeiten" : "Neuer Übergang"}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <Label className="text-[11px]">Von</Label>
                <Select value={form.fromKey} onValueChange={(v) => setForm((p) => (p ? { ...p, fromKey: String(v) } : p))}>
                  <SelectTrigger className="h-9 w-full min-w-0">
                    <SelectValue placeholder="Wählen …" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">Nach</Label>
                <Select value={form.toKey} onValueChange={(v) => setForm((p) => (p ? { ...p, toKey: String(v) } : p))}>
                  <SelectTrigger className="h-9 w-full min-w-0">
                    <SelectValue placeholder="Wählen …" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-[1fr_80px] gap-1.5">
              <div>
                <Label className="text-[11px]">Beschriftung des Knopfs</Label>
                <Input
                  value={form.actionLabel}
                  placeholder="z. B. Termin buchen"
                  onChange={(e) => setForm((p) => (p ? { ...p, actionLabel: e.target.value } : p))}
                />
              </div>
              <div>
                <Label className="text-[11px]">Reihenfolge</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => setForm((p) => (p ? { ...p, sortOrder: e.target.value } : p))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setForm(null)}>
                Abbrechen
              </Button>
              <Button type="button" size="sm" disabled={pending} onClick={submit}>
                Speichern
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
