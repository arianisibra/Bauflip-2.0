"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";
  const digest = error.digest;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-8 text-destructive" />
      </div>
      <h1 className="text-xl font-semibold text-foreground">Etwas ist schiefgelaufen</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut oder lade die Seite neu.
      </p>
      {digest ? (
        <p className="max-w-md font-mono text-xs text-muted-foreground">
          Referenz (für Logs/Support): <span className="select-all">{digest}</span>
        </p>
      ) : null}
      {isDev && error.message ? (
        <p className="max-w-md rounded-md border border-destructive/30 bg-destructive/5 p-3 text-left font-mono text-xs text-destructive">
          {error.message}
        </p>
      ) : null}
      <Button variant="outline" onClick={reset}>
        Erneut versuchen
      </Button>
    </div>
  );
}
