"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronDown,
  CloudUpload,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import type { Invoice, InvoiceStatus, ProjectStatus, Quote } from "@/lib/domain/types";
import {
  allowedInvoiceStatusTransitions,
  invoiceStatusBadgeClassNames,
  invoiceStatusLabels,
} from "@/lib/domain/types";
import { formatPaymentReference } from "@/lib/qr-bill/reference";
import {
  useCreateInvoice,
  useDeleteInvoice,
  useProjectInvoices,
  useProjectQuotes,
  usePushInvoiceToBexio,
  useQuoteMailConfig,
  useSetInvoiceStatus,
  useUpdateProjectStatus,
} from "@/lib/query/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InvoiceEditorDialog } from "@/components/app/invoice-editor-dialog";
import { InvoiceSendDialog } from "@/components/app/invoice-send-dialog";
import { cn } from "@/lib/utils";

const chf = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });

const INVOICE_STATUS_ACTION_LABELS: Record<InvoiceStatus, string> = {
  draft: "Zurück zu Entwurf",
  sent: "Als gesendet markieren",
  paid: "Als bezahlt markieren",
  cancelled: "Stornieren",
};

function defaultDueDate(): string {
  const d = new Date(Date.now() + 30 * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
  const setStatus = useSetInvoiceStatus();
  const deleteInvoice = useDeleteInvoice();
  const pushToBexio = usePushInvoiceToBexio();
  const updateProjectStatus = useUpdateProjectStatus();
  const mailConfig = useQuoteMailConfig(canEdit);
  const mailConfigured = mailConfig.data?.mailConfigured ?? false;

  /** null = geschlossen; { invoice: null } = neu; { invoice } = bearbeiten. */
  const [editor, setEditor] = useState<{ invoice: Invoice | null } | null>(null);
  const [sendTarget, setSendTarget] = useState<Invoice | null>(null);

  const invoices = invoicesQuery.data ?? [];
  const approvedQuotes = (quotesQuery.data ?? []).filter((q: Quote) => q.status === "approved");

  const openPdf = (invoiceId: string) =>
    window.open(`/api/invoices/${invoiceId}/pdf`, "_blank", "noopener,noreferrer");

  const onRowPrimary = (invoice: Invoice) => {
    if (canEdit && invoice.status === "draft") setEditor({ invoice });
    else openPdf(invoice.id);
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

  const changeStatus = async (invoice: Invoice, next: InvoiceStatus) => {
    if (next === "cancelled" && !window.confirm("Rechnung stornieren?")) return;
    try {
      await setStatus.mutateAsync({ invoiceId: invoice.id, projectId, status: next });
      toast.success(`Rechnung: ${invoiceStatusLabels[next]}`);
      if (next === "paid") await offerProjectCompletion();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Status fehlgeschlagen.");
    }
  };

  const pushInvoice = async (invoice: Invoice) => {
    try {
      await pushToBexio.mutateAsync(invoice.id);
      toast.success("An Bexio übertragen");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Übertragung fehlgeschlagen.");
    }
  };

  const removeInvoice = async (invoice: Invoice) => {
    if (!window.confirm(`Rechnung ${invoice.invoiceNumber ?? ""} wirklich löschen?`)) return;
    try {
      await deleteInvoice.mutateAsync({ invoiceId: invoice.id, projectId });
      toast.success("Rechnung gelöscht");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    }
  };

  return (
    <section className="border-t pt-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          Rechnungen{invoices.length > 0 ? ` (${invoices.length})` : ""}
        </h3>
        {canEdit ? (
          <div className="flex items-center gap-1.5">
            {approvedQuotes.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" disabled={createInvoice.isPending}>
                    Aus Offerte
                    <ChevronDown className="size-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {approvedQuotes.map((quote) => (
                    <DropdownMenuItem key={quote.id} onSelect={() => createFromQuote(quote)}>
                      {quote.quoteNumber ?? "Offerte"} · {chf.format(quote.totalGross)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => setEditor({ invoice: null })}>
              <Plus className="size-4" aria-hidden />
              Neue Rechnung
            </Button>
          </div>
        ) : null}
      </div>

      {invoicesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Rechnungen werden geladen …</p>
      ) : null}

      {!invoicesQuery.isLoading && invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Rechnung erfasst.</p>
      ) : null}

      <div className="space-y-1.5">
        {invoices.map((invoice) => {
          const canSend = canEdit && mailConfigured && (invoice.status === "draft" || invoice.status === "sent");
          const canPush = canEdit && invoice.status !== "draft" && !invoice.bexioInvoiceId;
          return (
            <div key={invoice.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5">
              <button type="button" onClick={() => onRowPrimary(invoice)} className="min-w-0 flex-1 text-left">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{invoice.invoiceNumber ?? "Rechnung"}</span>
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
                      Bexio-Fehler
                    </Badge>
                  ) : null}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {invoice.lineItems.length} Position{invoice.lineItems.length === 1 ? "" : "en"}
                  {invoice.dueDate
                    ? ` · fällig ${new Date(invoice.dueDate).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}`
                    : ""}
                  {invoice.paymentReference
                    ? ` · Ref. ${formatPaymentReference(invoice.referenceType, invoice.paymentReference)}`
                    : ""}
                </span>
              </button>

              <span className="shrink-0 text-sm font-semibold tabular-nums">{chf.format(invoice.totalGross)}</span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="size-8 shrink-0 p-0" aria-label="Aktionen">
                    <MoreHorizontal className="size-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
                      <FileText className="size-4" aria-hidden />
                      PDF öffnen
                    </a>
                  </DropdownMenuItem>
                  {canSend ? (
                    <DropdownMenuItem onSelect={() => setSendTarget(invoice)}>
                      <Send className="size-4" aria-hidden />
                      {invoice.status === "sent" ? "Erneut senden" : "Senden"}
                    </DropdownMenuItem>
                  ) : null}
                  {canEdit && invoice.status === "draft" ? (
                    <DropdownMenuItem onSelect={() => setEditor({ invoice })}>
                      <Pencil className="size-4" aria-hidden />
                      Bearbeiten
                    </DropdownMenuItem>
                  ) : null}
                  {canPush ? (
                    <DropdownMenuItem disabled={pushToBexio.isPending} onSelect={() => pushInvoice(invoice)}>
                      <CloudUpload className="size-4" aria-hidden />
                      {invoice.bexioSyncError ? "Bexio: erneut versuchen" : "Nach Bexio übertragen"}
                    </DropdownMenuItem>
                  ) : null}
                  {canEdit && allowedInvoiceStatusTransitions[invoice.status].length > 0 ? (
                    <>
                      <DropdownMenuSeparator />
                      {allowedInvoiceStatusTransitions[invoice.status].map((next) => (
                        <DropdownMenuItem
                          key={next}
                          disabled={setStatus.isPending}
                          onSelect={() => changeStatus(invoice, next)}
                          className={next === "cancelled" ? "text-destructive focus:text-destructive" : undefined}
                        >
                          {INVOICE_STATUS_ACTION_LABELS[next]}
                        </DropdownMenuItem>
                      ))}
                    </>
                  ) : null}
                  {canEdit && invoice.status === "draft" ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={deleteInvoice.isPending}
                        onSelect={() => removeInvoice(invoice)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4" aria-hidden />
                        Löschen
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>

      {canEdit ? (
        <>
          <InvoiceEditorDialog
            open={editor !== null}
            onOpenChange={(o) => (o ? null : setEditor(null))}
            projectId={projectId}
            invoice={editor?.invoice ?? null}
          />
          <InvoiceSendDialog
            open={sendTarget !== null}
            onOpenChange={(o) => (o ? null : setSendTarget(null))}
            projectId={projectId}
            invoice={sendTarget}
            defaultRecipientEmail={defaultRecipientEmail}
          />
        </>
      ) : null}
    </section>
  );
}
