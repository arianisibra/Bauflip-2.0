import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  searchParams: Promise<{ calendar?: string }>;
};

const calendarMsg: Record<string, string> = {
  google: "Google Kalender wurde verbunden. Neue Termine werden dort mit angelegt.",
  microsoft: "Outlook / Microsoft-Kalender wurde verbunden.",
  error: "Anmeldung abgebrochen oder ungültig.",
  config: "OAuth ist in der Umgebung nicht vollständig konfiguriert.",
  token: "Token-Austausch fehlgeschlagen.",
  norefresh: "Kein Refresh-Token erhalten — bitte erneut verbinden (Google: prompt=consent).",
  nodb: "Supabase nicht verbunden.",
  save: "Speichern der Verbindung fehlgeschlagen.",
};

export default async function IntegrationenPage(props: Props) {
  const sp = await props.searchParams;
  const calendarNote = sp.calendar ? calendarMsg[sp.calendar] ?? `Status: ${sp.calendar}` : null;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Integrationen</h1>

      {calendarNote ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{calendarNote}</div>
      ) : null}

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-medium">Kalender (Google &amp; Outlook)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Verbinden Sie Ihren Kalender — neue Bauflip-Termine werden zusätzlich zur ICS-E-Mail als Eintrag in Google
          Calendar oder Outlook angelegt (Monteur-Profil mit OAuth). Redirect-URIs in der Cloud-Konsole eintragen:{" "}
          <code className="rounded bg-muted px-1 text-xs">
            {process.env.NEXT_PUBLIC_SITE_URL ?? "https://ihre-domain.ch"}/api/calendar/google/callback
          </code>{" "}
          bzw.{" "}
          <code className="rounded bg-muted px-1 text-xs">…/api/calendar/microsoft/callback</code>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/api/calendar/google/authorize" className={buttonVariants()}>
            Google Kalender verbinden
          </Link>
          <Link href="/api/calendar/microsoft/authorize" className={buttonVariants({ variant: "outline" })}>
            Outlook verbinden
          </Link>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-medium">SMTP (Google / Outlook / Custom)</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="smtpHost">SMTP Host</Label>
            <Input id="smtpHost" placeholder="smtp.office365.com" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="smtpPort">Port</Label>
            <Input id="smtpPort" placeholder="587" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="smtpUser">Benutzer</Label>
            <Input id="smtpUser" placeholder="mail@firma.ch" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="smtpPass">Passwort / App-Passwort</Label>
            <Input id="smtpPass" type="password" />
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-medium">Stoffgenerator</h2>
        <p className="mt-1 text-sm text-muted-foreground">Externe Stoffauswahl mit Projektbezug.</p>
        <Link
          href="https://www.sonnentuch.ch/produkte-und-informationen/stoffe-und-dessins/stoffgenerator"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants(), "mt-3 inline-flex")}
        >
          Stoffgenerator öffnen
        </Link>
      </div>
    </section>
  );
}
