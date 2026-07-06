"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import type { Quote, QuoteStatus } from "@/lib/domain/types";
import { quoteStatusBadgeClassNames, quoteStatusLabels } from "@/lib/domain/types";
import { computeQuoteTotals } from "@/lib/quotes/totals";
import { quoteCreateSchema } from "@/lib/validations/forms";
import {
  useCreateQuote,
  useDeleteQuote,
  useProjectQuotes,
  useSetQuoteStatus,
  useUpdateQuote,
} from "@/lib/query/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const chf = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });

type EditableLineItem = {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
};

type EditorState = {
  /** null = neue Offerte, sonst Entwurf in Bearbeitung. */
  quoteId: string | null;
  validUntil: string;
  introText: string;
  outroText: string;
  vatRate: string;
  lineItems: EditableLineItem[];
};

const EMPTY_LINE: EditableLineItem = { description: "", quantity: "1", unit: "", unitPrice: "" };

function emptyEditor(): EditorState {
  return {
    quoteId: null,
    validUntil: "",
    introText: "",
    outroText: "",
    vatRate: "8.1",
    lineItems: [{ ...EMPTY_LINE }],
  };
}

function editorFromQuote(quote: Quote): EditorState {
  return {
    quoteId: quote.id,
    validUntil: quote.validUntil ?? "",
    introText: quote.introText ?? "",
    outroText: quote.outroText ?? "",
    vatRate: String(quote.vatRate),
    lineItems: quote.lineItems.map((item) => ({
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

/** Nächste sinnvolle Status-Schritte je aktuellem Offerten-Status (Phase 1: manuell). */
const NEXT_QUOTE_STATUSES: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["sent"],
  sent: ["approved", "rejected"],
  approved: [],
  rejected: ["draft"],
};

const QUOTE_STATUS_ACTION_LABELS: Record<QuoteStatus, string> = {
  draft: "Zurück zu Entwurf",
  sent: "Als gesendet markieren",
  approved: "Angenommen",
  rejected: "Abgelehnt",
};

export function ProjektQuotesSection({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const quotesQuery = useProjectQuotes(projectId);
  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();
  const setStatus = useSetQuoteStatus();
  const deleteQuote = useDeleteQuote();
  const [editor, setEditor] = useState<EditorState | null>(null);

  const quotes = quotesQuery.data ?? [];
  const pending = createQuote.isPending || updateQuote.isPending;

  const submitEditor = async () => {
    if (!editor) return;
    const payload = {
      projectId,
      validUntil: editor.validUntil || null,
      introText: editor.introText || null,
      outroText: editor.outroText || null,
      vatRate: Number(editor.vatRate.replace(",", ".")),
      lineItems: parsedLineItems(editor),
    };
    const parsed = quoteCreateSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
      return;
    }
    try {
      if (editor.quoteId) {
        await updateQuote.mutateAsync({ ...payload, quoteId: editor.quoteId });
        toast.success("Offerte aktualisiert");
      } else {
        await createQuote.mutateAsync(payload);
        toast.success("Offerte erstellt");
      }
      setEditor(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  };

  const editorTotals = editor
    ? computeQuoteTotals(
        parsedLineItems(editor).map((i) => ({
          ...i,
          quantity: Number.isFinite(i.quantity) ? i.quantity : 0,
          unitPrice: Number.isFinite(i.unitPrice) ? i.unitPrice : 0,
        })),
        Number(editor.vatRate.replace(",", ".")) || 0,
      )
    : null;

  return (
    <section className="border-t pt-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          Offerten{quotes.length > 0 ? ` (${quotes.length})` : ""}
        </h3>
        {canEdit && !editor ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditor(emptyEditor())}>
            <Plus className="size-4" aria-hidden />
            Neue Offerte
          </Button>
        ) : null}
      </div>

      {quotesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Offerten werden geladen …</p>
      ) : null}

      {!quotesQuery.isLoading && quotes.length === 0 && !editor ? (
        <p className="text-sm text-muted-foreground">Noch keine Offerte erfasst.</p>
      ) : null}

      <div className="space-y-2">
        {quotes.map((quote) => (
          <div key={quote.id} className="rounded-lg border border-border px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{quote.quoteNumber ?? "Offerte"}</span>
                <Badge variant="outline" className={cn(quoteStatusBadgeClassNames[quote.status])}>
                  {quoteStatusLabels[quote.status]}
                </Badge>
              </div>
              <span className="text-sm font-semibold tabular-nums">{chf.format(quote.totalGross)}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {quote.lineItems.length} Position{quote.lineItems.length === 1 ? "" : "en"} · netto{" "}
              {chf.format(quote.totalNet)} · MwSt. {quote.vatRate}%
              {quote.validUntil
                ? ` · gültig bis ${new Date(quote.validUntil).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}`
                : ""}
              {quote.createdByDisplayName ? ` · erstellt von ${quote.createdByDisplayName}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <a
                href={`/api/quotes/${quote.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <FileText className="size-4" aria-hidden />
                PDF
              </a>
              {canEdit ? (
                <>
                {NEXT_QUOTE_STATUSES[quote.status].map((next) => (
                  <Button
                    key={next}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={setStatus.isPending}
                    onClick={async () => {
                      try {
                        await setStatus.mutateAsync({ quoteId: quote.id, projectId, status: next });
                        toast.success(`Offerte: ${quoteStatusLabels[next]}`);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Status fehlgeschlagen.");
                      }
                    }}
                  >
                    {QUOTE_STATUS_ACTION_LABELS[next]}
                  </Button>
                ))}
                {quote.status === "draft" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditor(editorFromQuote(quote))}
                  >
                    <Pencil className="size-4" aria-hidden />
                    Bearbeiten
                  </Button>
                ) : null}
                {quote.status === "draft" || quote.status === "rejected" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    disabled={deleteQuote.isPending}
                    onClick={async () => {
                      try {
                        await deleteQuote.mutateAsync({ quoteId: quote.id, projectId });
                        toast.success("Offerte gelöscht");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
                      }
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Löschen
                  </Button>
                ) : null}
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {editor ? (
        <div className="mt-3 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
          <h4 className="text-sm font-semibold">
            {editor.quoteId ? "Offerte bearbeiten" : "Neue Offerte"}
          </h4>

          <div className="space-y-2">
            {editor.lineItems.map((item, index) => (
              <div key={index} className="grid grid-cols-[1fr_72px_64px_96px_auto] items-end gap-1.5">
                <div>
                  {index === 0 ? <Label className="text-[11px]">Beschreibung</Label> : null}
                  <Input
                    value={item.description}
                    placeholder="z. B. Storen-Motor ersetzen"
                    onChange={(e) =>
                      setEditor((prev) => {
                        if (!prev) return prev;
                        const lineItems = [...prev.lineItems];
                        lineItems[index] = { ...lineItems[index], description: e.target.value };
                        return { ...prev, lineItems };
                      })
                    }
                  />
                </div>
                <div>
                  {index === 0 ? <Label className="text-[11px]">Menge</Label> : null}
                  <Input
                    inputMode="decimal"
                    value={item.quantity}
                    onChange={(e) =>
                      setEditor((prev) => {
                        if (!prev) return prev;
                        const lineItems = [...prev.lineItems];
                        lineItems[index] = { ...lineItems[index], quantity: e.target.value };
                        return { ...prev, lineItems };
                      })
                    }
                  />
                </div>
                <div>
                  {index === 0 ? <Label className="text-[11px]">Einheit</Label> : null}
                  <Input
                    value={item.unit}
                    placeholder="Stk."
                    onChange={(e) =>
                      setEditor((prev) => {
                        if (!prev) return prev;
                        const lineItems = [...prev.lineItems];
                        lineItems[index] = { ...lineItems[index], unit: e.target.value };
                        return { ...prev, lineItems };
                      })
                    }
                  />
                </div>
                <div>
                  {index === 0 ? <Label className="text-[11px]">Preis (CHF)</Label> : null}
                  <Input
                    inputMode="decimal"
                    value={item.unitPrice}
                    onChange={(e) =>
                      setEditor((prev) => {
                        if (!prev) return prev;
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
                    setEditor((prev) =>
                      prev
                        ? { ...prev, lineItems: prev.lineItems.filter((_, i) => i !== index) }
                        : prev,
                    )
                  }
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setEditor((prev) =>
                  prev ? { ...prev, lineItems: [...prev.lineItems, { ...EMPTY_LINE }] } : prev,
                )
              }
            >
              <Plus className="size-4" aria-hidden />
              Position hinzufügen
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px]">Gültig bis</Label>
              <Input
                type="date"
                value={editor.validUntil}
                onChange={(e) =>
                  setEditor((prev) => (prev ? { ...prev, validUntil: e.target.value } : prev))
                }
              />
            </div>
            <div>
              <Label className="text-[11px]">MwSt. (%)</Label>
              <Input
                inputMode="decimal"
                value={editor.vatRate}
                onChange={(e) =>
                  setEditor((prev) => (prev ? { ...prev, vatRate: e.target.value } : prev))
                }
              />
            </div>
          </div>

          <div>
            <Label className="text-[11px]">Einleitungstext (optional)</Label>
            <Textarea
              rows={2}
              value={editor.introText}
              onChange={(e) =>
                setEditor((prev) => (prev ? { ...prev, introText: e.target.value } : prev))
              }
            />
          </div>
          <div>
            <Label className="text-[11px]">Schlusstext (optional)</Label>
            <Textarea
              rows={2}
              value={editor.outroText}
              onChange={(e) =>
                setEditor((prev) => (prev ? { ...prev, outroText: e.target.value } : prev))
              }
            />
          </div>

          {editorTotals ? (
            <div className="flex items-center justify-end gap-4 text-sm tabular-nums">
              <span className="text-muted-foreground">Netto {chf.format(editorTotals.totalNet)}</span>
              <span className="font-semibold">Total {chf.format(editorTotals.totalGross)}</span>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setEditor(null)}>
              Abbrechen
            </Button>
            <Button type="button" disabled={pending} onClick={submitEditor}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {editor.quoteId ? "Speichern" : "Offerte erstellen"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
