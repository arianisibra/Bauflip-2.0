"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Info,
  Loader2,
  RotateCcw,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stepper } from "@/components/ui/stepper";
import { FileInput } from "@/components/ui/file-input";
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

const STEPS = ["Datei", "Vorschau", "Bestätigt"];

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
  // key-Remount statt fileInputRef.value = "" — FileInput zeigt den Dateinamen selbst an
  // (lokaler State), das lässt sich nur über einen Neu-Mount zuverlässig zurücksetzen.
  const [fileInputKey, setFileInputKey] = useState(0);
  const [confirmResult, setConfirmResult] = useState<{ appliedCount: number; failedCount: number } | null>(null);
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

  // Der aktuelle Schritt ergibt sich aus dem Zustand — kein separater State nötig.
  const step = confirmResult ? 2 : results ? 1 : 0;

  const resetToUpload = () => {
    preview.reset();
    setConfirmResult(null);
    setSelectedFileName(null);
    setFileInputKey((k) => k + 1);
  };

  const handleFileCheck = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Bitte zuerst eine camt-Datei wählen.");
      return;
    }
    setConfirmResult(null);
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
      setConfirmResult({ appliedCount: result.appliedCount, failedCount: result.failedCount });
      preview.reset();
      setFileInputKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bestätigen fehlgeschlagen.");
    }
  };

  const showHistory = step !== 1;

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-border/60 pb-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Zahlungen</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          camt.053/054-Datei aus dem E-Banking hochladen — Zahlungen werden automatisch anhand der
          QR-Referenz den Rechnungen zugeordnet. Die Datei selbst wird nicht gespeichert.
        </p>
      </header>

      <Stepper steps={STEPS} current={step} />

      {step === 0 ? (
        <Card size="sm">
          <CardHeader className="px-4">
            <CardTitle className="text-sm font-semibold">1 · Datei wählen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <FileInput
                key={fileInputKey}
                ref={fileInputRef}
                accept=".xml,text/xml,application/xml"
                buttonLabel="Datei wählen"
                placeholder="Keine camt-Datei ausgewählt"
                className="flex-1"
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
      ) : null}

      {step === 1 && results ? (
        <Card size="sm">
          <CardHeader className="px-4">
            <CardTitle className="text-sm font-semibold">
              2 · Vorschau prüfen{selectedFileName ? ` — ${selectedFileName}` : ""}
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

            <div className="flex items-center justify-between gap-2 border-t pt-3">
              <Button type="button" variant="ghost" disabled={confirm.isPending} onClick={resetToUpload}>
                Andere Datei
              </Button>
              <Button type="button" disabled={confirm.isPending || matchedRows.length === 0} onClick={handleConfirm}>
                {confirm.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Zuordnung bestätigen ({matchedRows.length})
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 && confirmResult ? (
        <Card size="sm">
          <CardContent className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-7" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {confirmResult.appliedCount} Rechnung{confirmResult.appliedCount === 1 ? "" : "en"} als bezahlt markiert
              </p>
              {confirmResult.failedCount > 0 ? (
                <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                  {confirmResult.failedCount} übersprungen
                </p>
              ) : null}
            </div>
            <Button type="button" variant="outline" onClick={resetToUpload}>
              <RotateCcw className="size-4" aria-hidden />
              Neue Datei importieren
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {showHistory ? (
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
      ) : null}
    </section>
  );
}
