"use client";

/**
 * Fängt Fehler im Root-`layout` (Font, `<html>`/`<body>`), die `app/error.tsx` nicht erreichen.
 * In Production erscheint sonst nur die generische Next-Meldung ohne Digest in der UI.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const digest = error.digest;
  const isDev = process.env.NODE_ENV === "development";

  return (
    <html lang="de-CH">
      <body className="min-h-screen bg-background px-4 py-16 font-sans text-foreground antialiased">
        <div className="mx-auto flex max-w-md flex-col gap-4 text-center">
          <h1 className="text-xl font-semibold">Etwas ist schiefgelaufen</h1>
          <p className="text-sm text-muted-foreground">
            Ein Fehler ist beim Laden der Anwendung aufgetreten. Bitte Seite neu laden oder es später erneut versuchen.
          </p>
          {digest ? (
            <p className="font-mono text-xs text-muted-foreground">
              Referenz: <span className="select-all">{digest}</span>
            </p>
          ) : null}
          {isDev && error.message ? (
            <pre className="overflow-x-auto rounded-md border border-destructive/30 bg-destructive/5 p-3 text-left text-xs text-destructive">
              {error.message}
            </pre>
          ) : null}
          <button
            type="button"
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            onClick={() => reset()}
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  );
}
