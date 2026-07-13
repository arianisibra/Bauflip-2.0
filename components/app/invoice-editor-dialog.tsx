"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import type { Invoice, PriceBookItem } from "@/lib/domain/types";
import { computeQuoteTotals } from "@/lib/quotes/totals";
import { invoiceUpdateSchema, quoteLineItemSchema } from "@/lib/validations/forms";
import { useCreateInvoice, usePriceBookItems, useUpdateInvoice } from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stepper } from "@/components/ui/stepper";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const chf = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });

type EditableLineItem = {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
};

type EditorState = {
  invoiceId: string | null;
  dueDate: string;
  introText: string;
  vatRate: string;
  lineItems: EditableLineItem[];
};

const EMPTY_LINE: EditableLineItem = { description: "", quantity: "1", unit: "", unitPrice: "" };
const STEPS = ["Positionen", "Details", "Prüfen"];

function defaultDueDate(): string {
  const d = new Date(Date.now() + 30 * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyEditor(): EditorState {
  return { invoiceId: null, dueDate: defaultDueDate(), introText: "", vatRate: "8.1", lineItems: [{ ...EMPTY_LINE }] };
}

function editorFromInvoice(invoice: Invoice): EditorState {
  return {
    invoiceId: invoice.id,
    dueDate: invoice.dueDate ?? "",
    introText: invoice.introText ?? "",
    vatRate: String(invoice.vatRate),
    lineItems: invoice.lineItems.map((item) => ({
      description: item.description,
      quantity: String(item.quantity),
      unit: item.unit ?? "",
      unitPrice: String(item.unitPrice),
    })),
  };
}

function parsedLineItems(state: EditorState) {
  return state.lineItems.map((item) => ({
    description: item.description,
    quantity: Number(item.quantity.replace(",", ".")),
    unit: item.unit || null,
    unitPrice: Number(item.unitPrice.replace(",", ".")),
  }));
}

function isLineEmpty(line: EditableLineItem): boolean {
  return !line.description.trim() && !line.unitPrice.trim();
}

export function InvoiceEditorDialog({
  open,
  onOpenChange,
  projectId,
  invoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** null = neue Rechnung, sonst Entwurf in Bearbeitung. */
  invoice: Invoice | null;
}) {
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const priceBookQuery = usePriceBookItems(open);
  const priceBookItems = (priceBookQuery.data ?? []).filter((i: PriceBookItem) => i.isActive);

  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [step, setStep] = useState(0);

  const openKey = open ? (invoice?.id ?? "new") : null;
  const [initedKey, setInitedKey] = useState<string | null>(null);
  if (openKey !== initedKey) {
    setInitedKey(openKey);
    if (openKey !== null) {
      setEditor(invoice ? editorFromInvoice(invoice) : emptyEditor());
      setStep(0);
    }
  }

  const pending = createInvoice.isPending || updateInvoice.isPending;

  const appendLine = (line: EditableLineItem) => {
    setEditor((prev) => {
      const lineItems =
        prev.lineItems.length === 1 && isLineEmpty(prev.lineItems[0]) ? [line] : [...prev.lineItems, line];
      return { ...prev, lineItems };
    });
  };

  const addFromPriceBook = (itemId: string) => {
    const item = priceBookItems.find((i) => i.id === itemId);
    if (!item) return;
    appendLine({ description: item.name, quantity: "1", unit: item.unit ?? "", unitPrice: String(item.unitPrice) });
  };

  const totals = computeQuoteTotals(
    parsedLineItems(editor).map((i) => ({
      ...i,
      quantity: Number.isFinite(i.quantity) ? i.quantity : 0,
      unitPrice: Number.isFinite(i.unitPrice) ? i.unitPrice : 0,
    })),
    Number(editor.vatRate.replace(",", ".")) || 0,
  );

  const hasUsableLine = editor.lineItems.some((l) => l.description.trim() && l.unitPrice.trim());

  const goNext = () => {
    if (step === 0 && !hasUsableLine) {
      toast.error("Mindestens eine Position mit Beschreibung und Preis erfassen.");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = async () => {
    const base = {
      dueDate: editor.dueDate || null,
      introText: editor.introText || null,
      vatRate: Number(editor.vatRate.replace(",", ".")),
      lineItems: parsedLineItems(editor),
    };
    const itemsParsed = z
      .array(quoteLineItemSchema)
      .min(1, "Mindestens eine Position erfassen.")
      .safeParse(base.lineItems);
    if (!itemsParsed.success) {
      toast.error(itemsParsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
      return;
    }
    try {
      if (editor.invoiceId) {
        const parsed = invoiceUpdateSchema.safeParse({ ...base, invoiceId: editor.invoiceId });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
          return;
        }
        await updateInvoice.mutateAsync(parsed.data);
        toast.success("Rechnung aktualisiert");
      } else {
        await createInvoice.mutateAsync({ ...base, projectId, fromQuoteId: null });
        toast.success("Rechnung erstellt");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  };

  const footer = (
    <div className="flex items-center justify-between gap-2">
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={() => (step === 0 ? onOpenChange(false) : setStep((s) => s - 1))}
      >
        {step === 0 ? "Abbrechen" : "Zurück"}
      </Button>
      {step < STEPS.length - 1 ? (
        <Button type="button" onClick={goNext}>
          Weiter
        </Button>
      ) : (
        <Button type="button" disabled={pending} onClick={submit}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {editor.invoiceId ? "Speichern" : "Rechnung erstellen"}
        </Button>
      )}
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editor.invoiceId ? "Rechnung bearbeiten" : "Neue Rechnung"}
      description="Positionen, Details und Prüfen — in drei Schritten."
      className="max-w-2xl"
      footer={footer}
    >
      <div className="mb-5">
        <Stepper steps={STEPS} current={step} onStepClick={setStep} />
      </div>

      {step === 0 ? (
        <div className="space-y-3">
          <div className="hidden grid-cols-[1fr_72px_64px_96px_auto] gap-1.5 px-0.5 text-[11px] text-muted-foreground sm:grid">
            <span>Beschreibung</span>
            <span>Menge</span>
            <span>Einheit</span>
            <span>Preis (CHF)</span>
            <span />
          </div>
          {editor.lineItems.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-[1fr_auto] items-end gap-1.5 sm:grid-cols-[1fr_72px_64px_96px_auto]"
            >
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-[11px] sm:hidden">Beschreibung</Label>
                <Input
                  value={item.description}
                  placeholder="z. B. Storen-Motor ersetzt"
                  onChange={(e) =>
                    setEditor((prev) => {
                      const lineItems = [...prev.lineItems];
                      lineItems[index] = { ...lineItems[index], description: e.target.value };
                      return { ...prev, lineItems };
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-[11px] sm:hidden">Menge</Label>
                <Input
                  inputMode="decimal"
                  value={item.quantity}
                  onChange={(e) =>
                    setEditor((prev) => {
                      const lineItems = [...prev.lineItems];
                      lineItems[index] = { ...lineItems[index], quantity: e.target.value };
                      return { ...prev, lineItems };
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-[11px] sm:hidden">Einheit</Label>
                <Input
                  value={item.unit}
                  placeholder="Stk."
                  onChange={(e) =>
                    setEditor((prev) => {
                      const lineItems = [...prev.lineItems];
                      lineItems[index] = { ...lineItems[index], unit: e.target.value };
                      return { ...prev, lineItems };
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-[11px] sm:hidden">Preis (CHF)</Label>
                <Input
                  inputMode="decimal"
                  value={item.unitPrice}
                  onChange={(e) =>
                    setEditor((prev) => {
                      const lineItems = [...prev.lineItems];
                      lineItems[index] = { ...lineItems[index], unitPrice: e.target.value };
                      return { ...prev, lineItems };
                    })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={editor.lineItems.length <= 1}
                aria-label="Position entfernen"
                onClick={() =>
                  setEditor((prev) => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== index) }))
                }
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditor((prev) => ({ ...prev, lineItems: [...prev.lineItems, { ...EMPTY_LINE }] }))}
            >
              <Plus className="size-4" aria-hidden />
              Position
            </Button>
            {priceBookItems.length > 0 ? (
              <Select value="" onValueChange={(v) => addFromPriceBook(String(v))}>
                <SelectTrigger className="h-8 w-56 text-sm">
                  <SelectValue placeholder="Aus Preisstamm hinzufügen …" />
                </SelectTrigger>
                <SelectContent>
                  {priceBookItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({chf.format(item.unitPrice)}
                      {item.unit ? ` / ${item.unit}` : ""})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-4 border-t pt-3 text-sm tabular-nums">
            <span className="text-muted-foreground">Netto {chf.format(totals.totalNet)}</span>
            <span className="font-semibold">Total {chf.format(totals.totalGross)}</span>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px]">Fällig am</Label>
              <Input
                type="date"
                value={editor.dueDate}
                onChange={(e) => setEditor((prev) => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-[11px]">MwSt. (%)</Label>
              <Input
                inputMode="decimal"
                value={editor.vatRate}
                onChange={(e) => setEditor((prev) => ({ ...prev, vatRate: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label className="text-[11px]">Einleitungstext (optional)</Label>
            <Textarea
              rows={3}
              value={editor.introText}
              onChange={(e) => setEditor((prev) => ({ ...prev, introText: e.target.value }))}
            />
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-border">
            <ul className="divide-y divide-border/70">
              {editor.lineItems
                .filter((l) => l.description.trim() || l.unitPrice.trim())
                .map((l, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      {l.description || "—"}
                      <span className="ml-1.5 text-muted-foreground">
                        {l.quantity || "0"} {l.unit}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {chf.format((Number(l.quantity.replace(",", ".")) || 0) * (Number(l.unitPrice.replace(",", ".")) || 0))}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
          <dl className="space-y-1.5 rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Netto</dt>
              <dd className="tabular-nums">{chf.format(totals.totalNet)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">MwSt. {editor.vatRate}%</dt>
              <dd className="tabular-nums">{chf.format(totals.totalGross - totals.totalNet)}</dd>
            </div>
            <div className="flex justify-between border-t pt-1.5 font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{chf.format(totals.totalGross)}</dd>
            </div>
          </dl>
          <p className="text-[11px] text-muted-foreground">
            {editor.dueDate
              ? `Fällig am ${new Date(editor.dueDate).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}. `
              : ""}
            Nach dem Speichern kannst du die Rechnung als QR-PDF öffnen und per E-Mail versenden.
          </p>
        </div>
      ) : null}
    </Dialog>
  );
}
