import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/(app)/logout-action";

type Props =
  | { status: "pending" }
  | { status: "rejected"; reason: string | null };

/**
 * Ersetzt die gesamte App für Nutzer, deren Firma noch nicht freigegeben
 * (oder abgelehnt) ist — Freigabe-Workflow (Audit-Nachfrage). Kein Zugriff
 * auf Sidebar/Daten, nur ein Hinweis und die Abmeldung.
 */
export function OrganizationApprovalScreen(props: Props): React.ReactElement {
  const isRejected = props.status === "rejected";
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 dark:bg-muted/35">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">
          {isRejected ? "Registrierung nicht freigeschaltet" : "Ihre Firma wartet auf Freigabe"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {isRejected
            ? props.reason
              ? `Ihre Registrierung wurde leider abgelehnt: ${props.reason}`
              : "Ihre Registrierung wurde leider abgelehnt. Bei Fragen wenden Sie sich bitte an uns."
            : "Wir prüfen neue Registrierungen persönlich und schalten Ihre Firma zeitnah frei. Sie erhalten eine E-Mail, sobald es losgehen kann."}
        </p>
        <form action={logoutAction} className="mt-6">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <LogOut className="size-4" />
            Abmelden
          </button>
        </form>
      </div>
    </div>
  );
}
