"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Info,
  Loader2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CamtMatchResult } from "@/lib/camt/match";
import type { InvoiceForPaymentMatching } from "@/lib/db/invoices";
import {
  useConfirmPaymentImport,
  usePaymentImports,
  usePreviewPaymentImport,
} from "@/lib/query/hooks";
import { cn } from "@/lib/utils";

const chf = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });

type Row = CamtMatchResult<InvoiceForPaymentMatching>;

const KIND_META: Record<
  Row["kind"],
  { label: string; icon: typeof CheckCircle2; badgeClassName: string; iconClassName: string }
> = {
  matched: {
    label: "Zuordnung gefunden",
    icon: CheckCircle2,
    badgeClassName:
      "border-emerald-500/55 bg-emerald-500/15 text-emerald-700 dark:border-emerald-400/55 dark:bg-emerald-500/20 dark:text-emerald-300",
    iconClassName: "text-emerald-600 dark:text-emerald-400",
  },
  amountMismatch: {
    label: "Betrag weicht ab",
    icon: AlertTriangle,
    badgeClassName:
      "border-amber-500/55 bg-amber-500/15 text-amber-700 dark:border-amber-400/55 dark:bg-amber-500/20 dark:text-amber-300",
    iconClassName: "text-amber-600 dark:text-amber-400",
  },
  alreadyPaid: {
    label: "Bereits erfasst",
    icon: Info,
    badgeClassName:
      "border-sky-500/55 bg-sky-500/15 text-sky-700 dark:border-sky-400/55 dark:bg-sky-500/20 dark:text-sky-300",
    iconClassName: "text-sky-600 dark:text-sky-400",
  },
  unmatched: {
    label: "Keine Zuordnung",
    icon: CircleHelp,
    badgeClassName:
      "border-zinc-500/45 bg-zinc-500/10 text-zinc-600 dark:border-zinc-400/45 dark:bg-zinc-500/15 dark:text-zinc-400",
    iconClassName: "text-zinc-500 dark:text-zinc-400",
  },
};

function formatDateCh(iso: string): string {
  return new Date(iso).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });
}

export function ZahlungenPageClient() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const preview = usePreviewPaymentImport();
  const confirm = useConfirmPaymentImport();
  const importsQuery = usePaymentImports();

  const results = preview.data?.results ?? null;
  const matchedRows = (results ?? []).filter((r): r is Extract<Row, { kind: "matched" }> => r.kind === "matched");
  const counts = {
    matched: matchedRows.length,
    amountMismatch: (results ?? []).filter((r) => r.kind === "amountMismatch").length,
    alreadyPaid: (results ?? []).filter((r) => r.kind === "alreadyPaid").length,
    unmatched: (results ?? []).filter((r) => r.kind === "unmatched").length,
  };

  const handleFileCheck = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Bitte zuerst eine camt-Datei wählen.");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    try {
      const result = await preview.mutateAsync(fd);
      setSelectedFileName(result.filename);
      if (result.results.every((r) => r.kind !== "matched")) {
        toast.info("Keine neuen Zuordnungen in dieser Datei gefunden.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Datei konnte nicht geprüft werden.");
    }
  };

  const handleConfirm = async () => {
    if (!preview.data || matchedRows.length === 0) return;
    try {
      const result = await confirm.mutateAsync({
        filename: preview.data.filename,
        applications: matchedRows.map((r) => ({
          invoiceId: r.invoice.id,
          projectId: r.invoice.projectId,
          valueDate: r.entry.valueDate,
        })),
        summary: {
          entriesTotal: results?.length ?? 0,
          entriesMatched: counts.matched,
          entriesAlreadyPaid: counts.alreadyPaid,
          entriesAmountMismatch: counts.amountMismatch,
          entriesUnmatched: counts.unmatched,
        },
      });
      toast.success(
        result.failedCount > 0
          ? `${result.appliedCount} Rechnungen als bezahlt markiert (${result.failedCount} übersprungen)`
          : `${result.appliedCount} Rechnungen als bezahlt markiert`,
      );
      preview.reset();
      setSelectedFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bestätigen fehlgeschlagen.");
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-border/60 pb-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Zahlungen</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          camt.053/054-Datei aus dem E-Banking hochladen — Zahlungen werden automatisch anhand der
          QR-Referenz den Rechnungen zugeordnet. Die Datei selbst wird nicht gespeichert.
        </p>
      </header>

      <Card size="sm">
        <CardHeader className="px-4">
          <CardTitle className="text-sm font-semibold">Datei hochladen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="h-9 flex-1 rounded-md border border-input bg-background px-2.5 text-sm file:mr-2.5 file:h-full file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:text-xs file:font-medium"
            />
            <Button type="button" disabled={preview.isPending} onClick={handleFileCheck}>
              {preview.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-4" aria-hidden />
              )}
              Datei prüfen
            </Button>
          </div>
        </CardContent>
      </Card>

      {results ? (
        <Card size="sm">
          <CardHeader className="px-4">
            <CardTitle className="text-sm font-semibold">
              Vorschau{selectedFileName ? ` — ${selectedFileName}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-4">
            <div className="flex flex-wrap gap-2">
              {(Object.entries(counts) as [Row["kind"], number][]).map(([kind, count]) => {
                const meta = KIND_META[kind];
                const Icon = meta.icon;
                return (
                  <Badge key={kind} variant="outline" className={cn("gap-1", meta.badgeClassName)}>
                    <Icon className="size-3.5" aria-hidden />
                    {count} {meta.label}
                  </Badge>
                );
              })}
            </div>

            <div className="space-y-1.5">
              {results.map((row, index) => {
                const meta = KIND_META[row.kind];
                const Icon = meta.icon;
                const invoice = row.kind !== "unmatched" ? row.invoice : null;
                return (
                  <div
                    key={index}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon className={cn("size-4 shrink-0", meta.iconClassName)} aria-hidden />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {invoice?.invoiceNumber ?? row.entry.debtorName ?? "Unbekannter Zahler"}
                          {invoice?.projectTitle ? (
                            <span className="ml-1.5 font-normal text-muted-foreground">
                              — {invoice.projectTitle}
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-muted-foreground">
                          {formatDateCh(row.entry.valueDate)} · {row.entry.reference ?? row.entry.remittanceInfo ?? "ohne Referenz"}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold tabular-nums text-foreground">{chf.format(row.entry.amount)}</p>
                      {row.kind === "amountMismatch" ? (
                        <p className="text-amber-600 dark:text-amber-400">erwartet {chf.format(row.expectedAmount)}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end">
              <Button type="button" disabled={confirm.isPending || matchedRows.length === 0} onClick={handleConfirm}>
                {confirm.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Zuordnung bestätigen ({matchedRows.length})
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card size="sm">
        <CardHeader className="px-4">
          <CardTitle className="text-sm font-semibold">Import-Historie</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          {importsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">Wird geladen …</p>
          ) : (importsQuery.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Noch keine Zahlungen importiert.</p>
          ) : (
            <ul className="space-y-1.5">
              {(importsQuery.data ?? []).map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{entry.filename}</p>
                    <p className="text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}
                      {entry.importedByDisplayName ? ` · ${entry.importedByDisplayName}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-muted-foreground">
                    {entry.entriesMatched} zugeordnet
                    {entry.entriesAmountMismatch > 0 ? ` · ${entry.entriesAmountMismatch} abweichend` : ""}
                    {entry.entriesUnmatched > 0 ? ` · ${entry.entriesUnmatched} unklar` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
