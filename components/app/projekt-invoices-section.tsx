"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CloudUpload, FileText, Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import type { Invoice, InvoiceStatus, PriceBookItem, ProjectStatus, Quote } from "@/lib/domain/types";
import {
  allowedInvoiceStatusTransitions,
  invoiceStatusBadgeClassNames,
  invoiceStatusLabels,
} from "@/lib/domain/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeQuoteTotals } from "@/lib/quotes/totals";
import { formatPaymentReference } from "@/lib/qr-bill/reference";
import { invoiceUpdateSchema, quoteLineItemSchema } from "@/lib/validations/forms";
import {
  useCreateInvoice,
  useDeleteInvoice,
  usePriceBookItems,
  useProjectInvoices,
  useProjectQuotes,
  usePushInvoiceToBexio,
  useQuoteMailConfig,
  useSendInvoice,
  useSetInvoiceStatus,
  useUpdateInvoice,
  useUpdateProjectStatus,
} from "@/lib/query/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { z } from "zod";

const chf = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });

type EditableLineItem = {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
};

type EditorState = {
  /** null = neue Rechnung, sonst Entwurf in Bearbeitung. */
  invoiceId: string | null;
  dueDate: string;
  introText: string;
  vatRate: string;
  lineItems: EditableLineItem[];
};

const EMPTY_LINE: EditableLineItem = { description: "", quantity: "1", unit: "", unitPrice: "" };

/** Fälligkeit-Default: +30 Tage (lokales Datum reicht für ein Datumsfeld). */
function defaultDueDate(): string {
  const d = new Date(Date.now() + 30 * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyEditor(): EditorState {
  return {
    invoiceId: null,
    dueDate: defaultDueDate(),
    introText: "",
    vatRate: "8.1",
    lineItems: [{ ...EMPTY_LINE }],
  };
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

const INVOICE_STATUS_ACTION_LABELS: Record<InvoiceStatus, string> = {
  draft: "Zurück zu Entwurf",
  sent: "Als gesendet markieren",
  paid: "Als bezahlt markieren",
  cancelled: "Stornieren",
};

type SendFormState = {
  invoiceId: string;
  recipientEmail: string;
  message: string;
};

export function ProjektInvoicesSection({
  projectId,
  canEdit,
  defaultRecipientEmail,
  projectStatus,
}: {
  projectId: string;
  canEdit: boolean;
  /** Vorbefüllung «Senden an» — Mieter- oder Verwaltungs-Mail des Projekts. */
  defaultRecipientEmail?: string | null;
  /** Für das Abschluss-Angebot nach «bezahlt» (nur aus abrechnen/garantiefall erlaubt). */
  projectStatus?: ProjectStatus;
}) {
  const invoicesQuery = useProjectInvoices(projectId);
  const quotesQuery = useProjectQuotes(projectId, canEdit);
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const setStatus = useSetInvoiceStatus();
  const deleteInvoice = useDeleteInvoice();
  const sendInvoice = useSendInvoice();
  const pushToBexio = usePushInvoiceToBexio();
  const updateProjectStatus = useUpdateProjectStatus();
  const mailConfig = useQuoteMailConfig(canEdit);
  const mailConfigured = mailConfig.data?.mailConfigured ?? false;
  const [sendForm, setSendForm] = useState<SendFormState | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);

  const submitSend = async () => {
    if (!sendForm) return;
    try {
      await sendInvoice.mutateAsync({
        invoiceId: sendForm.invoiceId,
        projectId,
        recipientEmail: sendForm.recipientEmail.trim(),
        message: sendForm.message.trim() || null,
      });
      toast.success("Rechnung versendet");
      setSendForm(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Versand fehlgeschlagen.");
    }
  };

  /** Nach «bezahlt»: Projekt-Abschluss anbieten (Server validiert den Übergang nochmals). */
  const offerProjectCompletion = async () => {
    if (projectStatus !== "abrechnen" && projectStatus !== "garantiefall") return;
    if (!window.confirm("Rechnung bezahlt — Projekt als «Abgeschlossen» markieren?")) return;
    try {
      await updateProjectStatus.mutateAsync({ projectId, status: "abgeschlossen" });
      toast.success("Projekt abgeschlossen");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Abschluss fehlgeschlagen.");
    }
  };
  const priceBookQuery = usePriceBookItems(canEdit && Boolean(editor));
  const priceBookItems = (priceBookQuery.data ?? []).filter((i: PriceBookItem) => i.isActive);

  const invoices = invoicesQuery.data ?? [];
  const approvedQuotes = (quotesQuery.data ?? []).filter((q: Quote) => q.status === "approved");
  const pending = createInvoice.isPending || updateInvoice.isPending;

  const appendLine = (line: EditableLineItem) => {
    setEditor((prev) => {
      if (!prev) return prev;
      const lineItems =
        prev.lineItems.length === 1 && isLineEmpty(prev.lineItems[0])
          ? [line]
          : [...prev.lineItems, line];
      return { ...prev, lineItems };
    });
  };

  const addFromPriceBook = (itemId: string) => {
    const item = priceBookItems.find((i) => i.id === itemId);
    if (!item) return;
    appendLine({
      description: item.name,
      quantity: "1",
      unit: item.unit ?? "",
      unitPrice: String(item.unitPrice),
    });
  };

  const createFromQuote = async (quote: Quote) => {
    try {
      await createInvoice.mutateAsync({
        projectId,
        fromQuoteId: quote.id,
        dueDate: defaultDueDate(),
        introText: null,
        vatRate: quote.vatRate,
        lineItems: [],
      });
      toast.success(`Rechnung aus ${quote.quoteNumber ?? "Offerte"} erstellt`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erstellen fehlgeschlagen.");
    }
  };

  const submitEditor = async () => {
    if (!editor) return;
    const base = {
      dueDate: editor.dueDate || null,
      introText: editor.introText || null,
      vatRate: Number(editor.vatRate.replace(",", ".")),
      lineItems: parsedLineItems(editor),
    };
    const itemsParsed = z.array(quoteLineItemSchema).min(1, "Mindestens eine Position erfassen.").safeParse(base.lineItems);
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
          Rechnungen{invoices.length > 0 ? ` (${invoices.length})` : ""}
        </h3>
        {canEdit && !editor ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditor(emptyEditor())}>
            <Plus className="size-4" aria-hidden />
            Neue Rechnung
          </Button>
        ) : null}
      </div>

      {canEdit && !editor && approvedQuotes.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {approvedQuotes.map((quote) => (
            <Button
              key={quote.id}
              type="button"
              variant="outline"
              size="sm"
              disabled={createInvoice.isPending}
              onClick={() => createFromQuote(quote)}
            >
              Aus {quote.quoteNumber ?? "Offerte"} übernehmen ({chf.format(quote.totalGross)})
            </Button>
          ))}
        </div>
      ) : null}

      {invoicesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Rechnungen werden geladen …</p>
      ) : null}

      {!invoicesQuery.isLoading && invoices.length === 0 && !editor ? (
        <p className="text-sm text-muted-foreground">Noch keine Rechnung erfasst.</p>
      ) : null}

      <div className="space-y-2">
        {invoices.map((invoice) => (
          <div key={invoice.id} className="rounded-lg border border-border px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{invoice.invoiceNumber ?? "Rechnung"}</span>
                <Badge variant="outline" className={cn(invoiceStatusBadgeClassNames[invoice.status])}>
                  {invoiceStatusLabels[invoice.status]}
                </Badge>
                {invoice.bexioInvoiceId ? (
                  <Badge
                    variant="outline"
                    className="gap-1 border-emerald-500/55 bg-emerald-500/15 text-emerald-700 dark:border-emerald-400/55 dark:bg-emerald-500/20 dark:text-emerald-300"
                  >
                    <CloudUpload className="size-3" aria-hidden />
                    In Bexio
                  </Badge>
                ) : invoice.bexioSyncError ? (
                  <Badge
                    variant="outline"
                    className="gap-1 border-amber-500/55 bg-amber-500/15 text-amber-700 dark:border-amber-400/55 dark:bg-amber-500/20 dark:text-amber-300"
                    title={invoice.bexioSyncError}
                  >
                    <AlertTriangle className="size-3" aria-hidden />
                    Bexio-Übertragung fehlgeschlagen
                  </Badge>
                ) : null}
              </div>
              <span className="text-sm font-semibold tabular-nums">{chf.format(invoice.totalGross)}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {invoice.lineItems.length} Position{invoice.lineItems.length === 1 ? "" : "en"} · netto{" "}
              {chf.format(invoice.totalNet)} · MwSt. {invoice.vatRate}%
              {invoice.dueDate
                ? ` · fällig ${new Date(invoice.dueDate).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}`
                : ""}
              {invoice.paymentReference
                ? ` · Ref. ${formatPaymentReference(invoice.referenceType, invoice.paymentReference)}`
                : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <a
                href={`/api/invoices/${invoice.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <FileText className="size-4" aria-hidden />
                PDF
              </a>
              {canEdit && invoice.status !== "draft" && !invoice.bexioInvoiceId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pushToBexio.isPending}
                  onClick={async () => {
                    try {
                      await pushToBexio.mutateAsync(invoice.id);
                      toast.success("An Bexio übertragen");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Übertragung fehlgeschlagen.");
                    }
                  }}
                >
                  {pushToBexio.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <CloudUpload className="size-4" aria-hidden />
                  )}
                  {invoice.bexioSyncError ? "Bexio: erneut versuchen" : "Nach Bexio übertragen"}
                </Button>
              ) : null}
              {canEdit && mailConfigured && (invoice.status === "draft" || invoice.status === "sent") ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sendInvoice.isPending}
                  onClick={() =>
                    setSendForm((prev) =>
                      prev?.invoiceId === invoice.id
                        ? null
                        : {
                            invoiceId: invoice.id,
                            recipientEmail: invoice.sentToEmail ?? defaultRecipientEmail ?? "",
                            message: "",
                          },
                    )
                  }
                >
                  <Send className="size-4" aria-hidden />
                  {invoice.status === "sent" ? "Erneut senden" : "Senden"}
                </Button>
              ) : null}
              {canEdit ? (
                <>
                  {allowedInvoiceStatusTransitions[invoice.status].map((next) => (
                    <Button
                      key={next}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={setStatus.isPending}
                      onClick={async () => {
                        if (next === "cancelled" && !window.confirm("Rechnung stornieren?")) return;
                        try {
                          await setStatus.mutateAsync({ invoiceId: invoice.id, projectId, status: next });
                          toast.success(`Rechnung: ${invoiceStatusLabels[next]}`);
                          if (next === "paid") await offerProjectCompletion();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Status fehlgeschlagen.");
                        }
                      }}
                    >
                      {INVOICE_STATUS_ACTION_LABELS[next]}
                    </Button>
                  ))}
                  {invoice.status === "draft" ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditor(editorFromInvoice(invoice))}
                      >
                        <Pencil className="size-4" aria-hidden />
                        Bearbeiten
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={deleteInvoice.isPending}
                        onClick={async () => {
                          try {
                            await deleteInvoice.mutateAsync({ invoiceId: invoice.id, projectId });
                            toast.success("Rechnung gelöscht");
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
                          }
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden />
                        Löschen
                      </Button>
                    </>
                  ) : null}
                </>
              ) : null}
            </div>
            {sendForm?.invoiceId === invoice.id ? (
              <div className="mt-2 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                <div>
                  <Label className="text-[11px]">Senden an</Label>
                  <Input
                    type="email"
                    value={sendForm.recipientEmail}
                    placeholder="kunde@example.com"
                    onChange={(e) =>
                      setSendForm((prev) => (prev ? { ...prev, recipientEmail: e.target.value } : prev))
                    }
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Persönliche Nachricht (optional)</Label>
                  <Textarea
                    rows={2}
                    value={sendForm.message}
                    onChange={(e) =>
                      setSendForm((prev) => (prev ? { ...prev, message: e.target.value } : prev))
                    }
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={sendInvoice.isPending} onClick={() => setSendForm(null)}>
                    Abbrechen
                  </Button>
                  <Button type="button" size="sm" disabled={sendInvoice.isPending || !sendForm.recipientEmail.trim()} onClick={submitSend}>
                    {sendInvoice.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                    Mit PDF versenden
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {editor ? (
        <div className="mt-3 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
          <h4 className="text-sm font-semibold">
            {editor.invoiceId ? "Rechnung bearbeiten" : "Neue Rechnung"}
          </h4>

          <div className="space-y-2">
            {editor.lineItems.map((item, index) => (
              <div key={index} className="grid grid-cols-[1fr_72px_64px_96px_auto] items-end gap-1.5">
                <div>
                  {index === 0 ? <Label className="text-[11px]">Beschreibung</Label> : null}
                  <Input
                    value={item.description}
                    placeholder="z. B. Storen-Motor ersetzt"
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
            <div className="flex flex-wrap items-center gap-1.5">
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
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px]">Fällig am</Label>
              <Input
                type="date"
                value={editor.dueDate}
                onChange={(e) =>
                  setEditor((prev) => (prev ? { ...prev, dueDate: e.target.value } : prev))
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
              {editor.invoiceId ? "Speichern" : "Rechnung erstellen"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
