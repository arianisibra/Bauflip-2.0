"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { PriceBookItem } from "@/lib/domain/types";
import { priceBookItemSchema } from "@/lib/validations/forms";
import {
  useCreatePriceBookItem,
  useDeletePriceBookItem,
  usePriceBookItems,
  useUpdatePriceBookItem,
} from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsRow } from "@/components/app/settings-row";

const chf = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });

type ItemFormState = {
  /** null = neue Position. */
  id: string | null;
  name: string;
  unit: string;
  unitPrice: string;
};

const EMPTY_FORM: ItemFormState = { id: null, name: "", unit: "", unitPrice: "" };

/** Preisstamm-Verwaltung (Einstellungen): Zeile + Verwalten-Fenster mit Liste + Add/Edit. */
export function PriceBookManager() {
  const itemsQuery = usePriceBookItems();
  const createItem = useCreatePriceBookItem();
  const updateItem = useUpdatePriceBookItem();
  const deleteItem = useDeletePriceBookItem();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ItemFormState | null>(null);

  const items = itemsQuery.data ?? [];
  const pending = createItem.isPending || updateItem.isPending;

  const submit = async () => {
    if (!form) return;
    const payload = {
      name: form.name,
      unit: form.unit || null,
      unitPrice: Number(form.unitPrice.replace(",", ".")),
    };
    const parsed = priceBookItemSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
      return;
    }
    try {
      if (form.id) {
        await updateItem.mutateAsync({ ...payload, id: form.id });
        toast.success("Position aktualisiert");
      } else {
        await createItem.mutateAsync(payload);
        toast.success("Position erstellt");
      }
      setForm(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  };

  const summary = itemsQuery.isLoading
    ? "Wird geladen …"
    : items.length === 0
      ? "Noch keine Positionen"
      : `${items.length} Position${items.length === 1 ? "" : "en"}`;

  return (
    <>
      <SettingsRow
        title="Preisstamm"
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
        title="Preisstamm"
        description="Wiederverwendbare Positionen für Offerten (Material, Arbeitszeit, Pauschalen)."
        footer={
          <div className="flex items-center justify-between gap-2">
            {!form ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...EMPTY_FORM })}>
                <Plus className="size-4" aria-hidden />
                Neue Position
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
        {itemsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Preisstamm wird geladen …</p>
        ) : null}
        {!itemsQuery.isLoading && items.length === 0 && !form ? (
          <p className="text-sm text-muted-foreground">Noch keine Positionen erfasst.</p>
        ) : null}

        <ul className="divide-y divide-border">
          {items.map((item: PriceBookItem) => (
            <li key={item.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm">{item.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {chf.format(item.unitPrice)}
                  {item.unit ? ` / ${item.unit}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Bearbeiten"
                  onClick={() =>
                    setForm({ id: item.id, name: item.name, unit: item.unit ?? "", unitPrice: String(item.unitPrice) })
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
                  disabled={deleteItem.isPending}
                  onClick={async () => {
                    try {
                      await deleteItem.mutateAsync({ itemId: item.id });
                      toast.success("Position gelöscht");
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
              {form.id ? "Position bearbeiten" : "Neue Position"}
            </p>
            <div className="grid grid-cols-[1fr_80px_110px] gap-1.5">
              <div>
                <Label className="text-[11px]">Bezeichnung</Label>
                <Input
                  value={form.name}
                  placeholder="z. B. Arbeitszeit Monteur"
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                />
              </div>
              <div>
                <Label className="text-[11px]">Einheit</Label>
                <Input
                  value={form.unit}
                  placeholder="h"
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, unit: e.target.value } : prev))}
                />
              </div>
              <div>
                <Label className="text-[11px]">Preis (CHF)</Label>
                <Input
                  inputMode="decimal"
                  value={form.unitPrice}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, unitPrice: e.target.value } : prev))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setForm(null)}>
                Abbrechen
              </Button>
              <Button type="button" size="sm" disabled={pending} onClick={submit}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {form.id ? "Speichern" : "Erstellen"}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
