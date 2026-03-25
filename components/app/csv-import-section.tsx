"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { importCsvAction } from "@/app/(app)/actions";
import { buttonVariants } from "@/components/ui/button-variants";
import { Label } from "@/components/ui/label";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { cn } from "@/lib/utils";

type Props = {
  type: "contacts" | "articles";
  title: string;
  templateHref: string;
  exportHref: string;
  /** Kurzinfo zu Pflichtfeldern */
  hint: string;
};

export function CsvImportSection({ type, title, templateHref, exportHref, hint }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-muted-foreground">
        <li>
          Vorlage herunterladen (festes Spaltenformat, UTF-8).{" "}
          <Link href={templateHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-1 inline-flex")}>
            Vorlage CSV
          </Link>
        </li>
        <li>Datei in Excel oder einem Editor ausfüllen — die erste Zeile (Spaltennamen) nicht ändern.</li>
        <li>Die ausgefüllte CSV-Datei hier hochladen.</li>
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>

      <form
        className="mt-4 flex flex-col gap-3"
        action={async (formData) => {
          setPending(true);
          setError(null);
          setMessage(null);
          try {
            await importCsvAction(formData);
            setMessage("Import erfolgreich abgeschlossen.");
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Import fehlgeschlagen.");
          } finally {
            setPending(false);
          }
        }}
      >
        <input type="hidden" name="type" value={type} />
        <div className="flex flex-col gap-2">
          <Label htmlFor={`file-${type}`}>CSV-Datei</Label>
          <input
            id={`file-${type}`}
            name="file"
            type="file"
            accept=".csv,text/csv,text/plain"
            required
            className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className={cn(buttonVariants(), pending && "pointer-events-none opacity-70")}
          >
            {pending ? (
              <BauflipLoadingButtonLabel variant="onPrimary">Import läuft …</BauflipLoadingButtonLabel>
            ) : (
              "CSV importieren"
            )}
          </button>
          <Link href={exportHref} className={buttonVariants({ variant: "secondary" })}>
            Bestand exportieren
          </Link>
        </div>
      </form>

      {message ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{message}</p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
      ) : null}

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-muted-foreground">CSV-Text einfügen (Alternative)</summary>
        <form
          className="mt-2 flex flex-col gap-2"
          action={async (formData) => {
            setPending(true);
            setError(null);
            setMessage(null);
            try {
              await importCsvAction(formData);
              setMessage("Import erfolgreich abgeschlossen.");
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Import fehlgeschlagen.");
            } finally {
              setPending(false);
            }
          }}
        >
          <input type="hidden" name="type" value={type} />
          <Label htmlFor={`paste-${type}`}>CSV-Inhalt</Label>
          <textarea
            id={`paste-${type}`}
            name="csvText"
            rows={5}
            className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder="Kopfzeile aus der Vorlage beibehalten …"
          />
          <button type="submit" disabled={pending} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}>
            {pending ? (
              <BauflipLoadingButtonLabel variant="onSurface">Import läuft …</BauflipLoadingButtonLabel>
            ) : (
              "Aus Zwischenablage importieren"
            )}
          </button>
        </form>
      </details>
    </div>
  );
}
