"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileText, FileType, MoreHorizontal, Pencil, Plus, Send, Trash2, XCircle } from "lucide-react";
import type { Quote, QuoteStatus, TechnicianReport } from "@/lib/domain/types";
import {
  allowedQuoteStatusTransitions,
  quoteStatusBadgeClassNames,
  quoteStatusLabels,
} from "@/lib/domain/types";
import {
  useDeleteQuote,
  useHasOfferDocumentTemplate,
  useProjectQuotes,
  useQuoteMailConfig,
  useSetQuoteStatus,
} from "@/lib/query/hooks";
import { useSessionProfile } from "@/components/app/session-profile-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuoteApprovalRejectDialog } from "@/components/app/quote-approval-reject-dialog";
import { QuoteEditorDialog } from "@/components/app/quote-editor-dialog";
import { QuoteSendDialog } from "@/components/app/quote-send-dialog";
import { cn } from "@/lib/utils";

const chf = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });

const QUOTE_STATUS_ACTION_LABELS: Record<QuoteStatus, string> = {
  draft: "Zurück zu Entwurf",
  pending_approval: "Zur Freigabe einreichen",
  sent: "Als gesendet markieren",
  approved: "Angenommen",
  rejected: "Abgelehnt",
};

/**
 * Generische Statuswechsel-Buttons — «sent» ausgeschlossen: Versand läuft immer
 * über den PDF-Mail-Dialog (`QuoteSendDialog`), nie als blosser Statuswechsel.
 */
function genericStatusTargets(status: QuoteStatus, isAdmin: boolean): QuoteStatus[] {
  return allowedQuoteStatusTransitions[status].filter((next) => {
    if (next === "sent") return false;
    // Admin nutzt für pending_approval → draft die «Zurückweisen»-Aktion mit Kommentar,
    // nicht den stummen Statuswechsel — sonst zwei Buttons für dieselbe Sache.
    if (isAdmin && status === "pending_approval" && next === "draft") return false;
    return true;
  });
}

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
  const hasWordTemplate = useHasOfferDocumentTemplate(canEdit).data ?? false;
  const isAdmin = useSessionProfile().role === "admin";

  /** null = geschlossen; { quote: null } = neu; { quote } = bearbeiten. */
  const [editor, setEditor] = useState<{ quote: Quote | null } | null>(null);
  const [sendTarget, setSendTarget] = useState<Quote | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Quote | null>(null);

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
          const canApproveAndSend =
            canEdit &&
            isAdmin &&
            mailConfigured &&
            (quote.status === "pending_approval" || quote.status === "sent");
          const canDelete = canEdit && (quote.status === "draft" || quote.status === "rejected");
          const statusTargets = genericStatusTargets(quote.status, isAdmin);
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
                  {quote.status === "pending_approval" ? " · wartet auf Freigabe" : ""}
                </span>
                {quote.status === "draft" && quote.approvalNote ? (
                  <span className="mt-0.5 block truncate text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    Vom Admin zurückgewiesen: {quote.approvalNote}
                  </span>
                ) : null}
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
                  {hasWordTemplate ? (
                    <DropdownMenuItem asChild>
                      <a href={`/api/quotes/${quote.id}/document`} target="_blank" rel="noreferrer">
                        <FileType className="size-4" aria-hidden />
                        Als Word (Vorlage)
                      </a>
                    </DropdownMenuItem>
                  ) : null}
                  {hasWordTemplate ? (
                    <DropdownMenuItem asChild>
                      <a href={`/api/quotes/${quote.id}/document?format=pdf`} target="_blank" rel="noreferrer">
                        <FileType className="size-4" aria-hidden />
                        Als PDF (Vorlage)
                      </a>
                    </DropdownMenuItem>
                  ) : null}
                  {canApproveAndSend ? (
                    <DropdownMenuItem onSelect={() => setSendTarget(quote)}>
                      <Send className="size-4" aria-hidden />
                      {quote.status === "sent" ? "Erneut senden" : "Freigeben & senden"}
                    </DropdownMenuItem>
                  ) : null}
                  {isAdmin && quote.status === "pending_approval" ? (
                    <DropdownMenuItem onSelect={() => setRejectTarget(quote)}>
                      <XCircle className="size-4" aria-hidden />
                      Zurückweisen (mit Kommentar)
                    </DropdownMenuItem>
                  ) : null}
                  {canEdit && quote.status === "draft" ? (
                    <DropdownMenuItem onSelect={() => setEditor({ quote })}>
                      <Pencil className="size-4" aria-hidden />
                      Bearbeiten
                    </DropdownMenuItem>
                  ) : null}
                  {canEdit && statusTargets.length > 0 ? (
                    <>
                      <DropdownMenuSeparator />
                      {statusTargets.map((next) => (
                        <DropdownMenuItem
                          key={next}
                          disabled={setStatus.isPending}
                          onSelect={() => changeStatus(quote, next)}
                        >
                          {next === "pending_approval" ? (
                            <CheckCircle2 className="size-4" aria-hidden />
                          ) : null}
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
          {isAdmin ? (
            <QuoteApprovalRejectDialog
              open={rejectTarget !== null}
              onOpenChange={(o) => (o ? null : setRejectTarget(null))}
              projectId={projectId}
              quote={rejectTarget}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}
