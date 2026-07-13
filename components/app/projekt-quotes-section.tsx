"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, MoreHorizontal, Pencil, Plus, Send, Trash2 } from "lucide-react";
import type { Quote, QuoteStatus, TechnicianReport } from "@/lib/domain/types";
import {
  allowedQuoteStatusTransitions,
  quoteStatusBadgeClassNames,
  quoteStatusLabels,
} from "@/lib/domain/types";
import {
  useDeleteQuote,
  useProjectQuotes,
  useQuoteMailConfig,
  useSetQuoteStatus,
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
import { QuoteEditorDialog } from "@/components/app/quote-editor-dialog";
import { QuoteSendDialog } from "@/components/app/quote-send-dialog";
import { cn } from "@/lib/utils";

const chf = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });

const QUOTE_STATUS_ACTION_LABELS: Record<QuoteStatus, string> = {
  draft: "Zurück zu Entwurf",
  sent: "Als gesendet markieren",
  approved: "Angenommen",
  rejected: "Abgelehnt",
};

export function ProjektQuotesSection({
  projectId,
  canEdit,
  defaultRecipientEmail,
  latestReport,
}: {
  projectId: string;
  canEdit: boolean;
  /** Vorbefüllung «Senden an» — Mieter- oder Verwaltungs-Mail des Projekts. */
  defaultRecipientEmail?: string | null;
  /** Neuester Rapport — für «Aus Rapport übernehmen» im Offert-Editor. */
  latestReport?: Pick<TechnicianReport, "workDescription" | "summary" | "timeSpentMinutes"> | null;
}) {
  const quotesQuery = useProjectQuotes(projectId);
  const setStatus = useSetQuoteStatus();
  const deleteQuote = useDeleteQuote();
  const mailConfig = useQuoteMailConfig(canEdit);
  const mailConfigured = mailConfig.data?.mailConfigured ?? false;

  /** null = geschlossen; { quote: null } = neu; { quote } = bearbeiten. */
  const [editor, setEditor] = useState<{ quote: Quote | null } | null>(null);
  const [sendTarget, setSendTarget] = useState<Quote | null>(null);

  const quotes = quotesQuery.data ?? [];

  const openPdf = (quoteId: string) =>
    window.open(`/api/quotes/${quoteId}/pdf`, "_blank", "noopener,noreferrer");

  const onRowPrimary = (quote: Quote) => {
    if (canEdit && quote.status === "draft") setEditor({ quote });
    else openPdf(quote.id);
  };

  const changeStatus = async (quote: Quote, next: QuoteStatus) => {
    try {
      await setStatus.mutateAsync({ quoteId: quote.id, projectId, status: next });
      toast.success(`Offerte: ${quoteStatusLabels[next]}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Status fehlgeschlagen.");
    }
  };

  const removeQuote = async (quote: Quote) => {
    if (!window.confirm(`Offerte ${quote.quoteNumber ?? ""} wirklich löschen?`)) return;
    try {
      await deleteQuote.mutateAsync({ quoteId: quote.id, projectId });
      toast.success("Offerte gelöscht");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    }
  };

  return (
    <section className="border-t pt-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          Offerten{quotes.length > 0 ? ` (${quotes.length})` : ""}
        </h3>
        {canEdit ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditor({ quote: null })}>
            <Plus className="size-4" aria-hidden />
            Neue Offerte
          </Button>
        ) : null}
      </div>

      {quotesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Offerten werden geladen …</p>
      ) : null}

      {!quotesQuery.isLoading && quotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Offerte erfasst.</p>
      ) : null}

      <div className="space-y-1.5">
        {quotes.map((quote) => {
          const canSend = canEdit && mailConfigured && (quote.status === "draft" || quote.status === "sent");
          const canDelete = canEdit && (quote.status === "draft" || quote.status === "rejected");
          return (
            <div
              key={quote.id}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5"
            >
              <button
                type="button"
                onClick={() => onRowPrimary(quote)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{quote.quoteNumber ?? "Offerte"}</span>
                  <Badge variant="outline" className={cn(quoteStatusBadgeClassNames[quote.status])}>
                    {quoteStatusLabels[quote.status]}
                  </Badge>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {quote.lineItems.length} Position{quote.lineItems.length === 1 ? "" : "en"}
                  {quote.validUntil
                    ? ` · gültig bis ${new Date(quote.validUntil).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}`
                    : ""}
                  {quote.status === "sent" && quote.sentToEmail ? ` · gesendet an ${quote.sentToEmail}` : ""}
                </span>
              </button>

              <span className="shrink-0 text-sm font-semibold tabular-nums">{chf.format(quote.totalGross)}</span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="size-8 shrink-0 p-0" aria-label="Aktionen">
                    <MoreHorizontal className="size-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noreferrer">
                      <FileText className="size-4" aria-hidden />
                      PDF öffnen
                    </a>
                  </DropdownMenuItem>
                  {canSend ? (
                    <DropdownMenuItem onSelect={() => setSendTarget(quote)}>
                      <Send className="size-4" aria-hidden />
                      {quote.status === "sent" ? "Erneut senden" : "Senden"}
                    </DropdownMenuItem>
                  ) : null}
                  {canEdit && quote.status === "draft" ? (
                    <DropdownMenuItem onSelect={() => setEditor({ quote })}>
                      <Pencil className="size-4" aria-hidden />
                      Bearbeiten
                    </DropdownMenuItem>
                  ) : null}
                  {canEdit && allowedQuoteStatusTransitions[quote.status].length > 0 ? (
                    <>
                      <DropdownMenuSeparator />
                      {allowedQuoteStatusTransitions[quote.status].map((next) => (
                        <DropdownMenuItem
                          key={next}
                          disabled={setStatus.isPending}
                          onSelect={() => changeStatus(quote, next)}
                        >
                          {QUOTE_STATUS_ACTION_LABELS[next]}
                        </DropdownMenuItem>
                      ))}
                    </>
                  ) : null}
                  {canDelete ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={deleteQuote.isPending}
                        onSelect={() => removeQuote(quote)}
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
          <QuoteEditorDialog
            open={editor !== null}
            onOpenChange={(o) => (o ? null : setEditor(null))}
            projectId={projectId}
            quote={editor?.quote ?? null}
            latestReport={latestReport}
          />
          <QuoteSendDialog
            open={sendTarget !== null}
            onOpenChange={(o) => (o ? null : setSendTarget(null))}
            projectId={projectId}
            quote={sendTarget}
            defaultRecipientEmail={defaultRecipientEmail}
          />
        </>
      ) : null}
    </section>
  );
}
