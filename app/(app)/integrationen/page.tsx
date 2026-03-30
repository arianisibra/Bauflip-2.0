import Link from "next/link";
import { saveZapierSettingsAction, testZapierConnectionAction } from "@/app/(app)/integrationen/actions";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdminSession } from "@/lib/auth/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BAUFLIP_ZAPIER_EVENTS } from "@/lib/integrations/zapier-events";

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
  const session = await requireAdminSession();
  const supabase = await createSupabaseServerClient();
  const { data: org } = await (supabase
    ? supabase
        .from("organizations")
        .select("zapier_enabled, zapier_webhook_url, zapier_signing_secret, zapier_last_test_at, zapier_last_error")
        .eq("id", session.organizationId)
        .maybeSingle()
    : Promise.resolve({ data: null }));
  const zapierEnabled = Boolean(org?.zapier_enabled);
  const zapierWebhookUrl = String(org?.zapier_webhook_url ?? "");
  const zapierSecret = String(org?.zapier_signing_secret ?? "");
  const lastTest = org?.zapier_last_test_at ? new Date(org.zapier_last_test_at).toLocaleString("de-CH") : "Noch nie";
  const webhookInUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://ihre-domain.ch"}/api/integrations/zapier/bexio`;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Integrationen</h1>

      {calendarNote ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{calendarNote}</div>
      ) : null}

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-medium">Bexio via Zapier</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Aktivieren Sie den ausgehenden BauFlip-Webhook für Zapier. Empfohlener Aufbau: Catch Hook als Trigger, optional{" "}
          <span className="text-foreground">Paths</span> nach Ereignistyp, danach die passende bexio-Aktion (z. B. Verkaufsangebot
          oder Verkaufsrechnung als <span className="text-foreground">Entwurf</span>). BauFlip liefert Kontakt-Referenz und Positionen;
          Briefanrede und feine Texte pflegen Sie in bexio. PDF-Akte und geführter Projektstatus bleiben in BauFlip massgebend; Versand
          an Kunden oft in bexio. Für
          sichere Signaturprüfung: Secret als HMAC SHA-256 in den Headern.
        </p>
        <details className="mt-4 rounded-lg border border-border/80 bg-muted/10 open:bg-muted/15">
          <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-foreground outline-none hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-2">
              <span>Anleitung &amp; technische Details (Events, JSON, bexio-Kunde)</span>
              <span className="text-xs font-normal text-muted-foreground">Ein- / ausklappen</span>
            </span>
          </summary>
          <div className="space-y-3 border-t border-border/60 px-3 pb-3 pt-3">
        <div className="overflow-x-auto rounded-md border border-border/70 text-xs">
          <table className="w-full min-w-[32rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40">
                <th className="px-3 py-2 font-medium text-foreground">eventType (JSON-Root)</th>
                <th className="px-3 py-2 font-medium text-foreground">Auslöser in BauFlip</th>
                <th className="px-3 py-2 font-medium text-foreground">Typischer Zapier-Pfad / bexio</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border/60">
                <td className="px-3 py-2 font-mono text-[11px] text-foreground">{BAUFLIP_ZAPIER_EVENTS.QUOTE_CREATED}</td>
                <td className="px-3 py-2">
                  Offerte gespeichert oder finalisiert (PDF/bexio) — immer dasselbe <span className="font-mono">eventType</span>
                </td>
                <td className="px-3 py-2">
                  Ein Zap-Filter: <span className="font-mono">bauflip.quote.created</span>. Mit <span className="font-mono">pdfPath</span> im
                  Payload = nach Finalisieren
                </td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="px-3 py-2 font-mono text-[11px] text-foreground">{BAUFLIP_ZAPIER_EVENTS.INVOICE_CREATED}</td>
                <td className="px-3 py-2">
                  Rechnung vorbereitet oder finalisiert (PDF/bexio) — immer dasselbe <span className="font-mono">eventType</span>.
                  Früher <span className="font-mono">bauflip.invoice.finalized</span>: Zaps bitte auf dieses Event umstellen.
                </td>
                <td className="px-3 py-2">
                  Ein Zap-Filter: <span className="font-mono">bauflip.invoice.created</span>. Mit <span className="font-mono">pdfPath</span> im
                  Payload = nach Finalisieren; Versand an Kunden in bexio
                </td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="px-3 py-2 font-mono text-[11px] text-foreground">{BAUFLIP_ZAPIER_EVENTS.REPORT_CREATED}</td>
                <td className="px-3 py-2">Monteurbericht erstellt</td>
                <td className="px-3 py-2">Eigener Pfad nach Bedarf</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-[11px] text-foreground">{BAUFLIP_ZAPIER_EVENTS.INTEGRATION_TEST}</td>
                <td className="px-3 py-2">«Verbindung testen» auf dieser Seite</td>
                <td className="px-3 py-2">Filter für Tests (optional)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">JSON &amp; Filter in Zapier</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>
              Root-Felder: <span className="font-mono text-[11px] text-foreground">id</span>,{" "}
              <span className="font-mono text-[11px] text-foreground">eventType</span>,{" "}
              <span className="font-mono text-[11px] text-foreground">occurredAt</span>,{" "}
              <span className="font-mono text-[11px] text-foreground">organizationId</span>,{" "}
              <span className="font-mono text-[11px] text-foreground">payload</span> (Objekt).
            </li>
            <li>
              Derselbe Wert wie <span className="font-mono text-[11px] text-foreground">eventType</span> steht im Header{" "}
              <span className="font-mono text-[11px] text-foreground">X-Bauflip-Event</span> — für Paths/Filter nutzbar,
              wenn Zapier Header ausliefert.
            </li>
            <li>
              Kontakt und Positionen liegen unter <span className="font-mono text-[11px] text-foreground">payload</span>
              : <span className="font-mono text-[11px] text-foreground">bexioContactIdNumeric</span>,{" "}
              <span className="font-mono text-[11px] text-foreground">contactName</span>,{" "}
              <span className="font-mono text-[11px] text-foreground">contactEmail</span>,{" "}
              <span className="font-mono text-[11px] text-foreground">lineItems</span>: je Zeile{" "}
              <span className="font-mono text-[11px] text-foreground">bexioArticleIdNumeric</span> (wenn am BauFlip-Artikel
              hinterlegt), sonst <span className="font-mono text-[11px] text-foreground">null</span>.
            </li>
          </ul>
        </div>
        <div className="rounded-md border border-border/70 bg-muted/25 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">bexio-Kunde voll automatisch (empfohlen)</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4">
            <li>Kunden zuerst in bexio anlegen.</li>
            <li>
              Im BauFlip-Kontakt unter <span className="text-foreground">«bexio Kontakt-ID»</span> die ID aus bexio
              eintragen (Kontakt bearbeiten / neuer Kontakt).
            </li>
            <li>
              Im bexio-Schritt <span className="text-foreground">contact_id</span> / Kontakt:{" "}
              <span className="font-mono text-[11px] text-foreground">payload.bexioContactIdNumeric</span> mappen (Zahl,
              ohne führende Nullen).
            </li>
            <li>
              <span className="text-foreground">Ohne gültige ID:</span>{" "}
              <span className="font-mono text-[11px] text-foreground">contactName</span> und{" "}
              <span className="font-mono text-[11px] text-foreground">contactEmail</span> für bexio «Kontakt suchen» (o. Ä.),
              dann die gefundene ID in den Erstell-Schritt geben.
            </li>
            <li>
              Artikel: bexio-Produkt-ID am BauFlip-Artikel unter «bexio Artikel-ID» eintragen — dann steht pro Zeile{" "}
              <span className="font-mono text-[11px]">bexioArticleIdNumeric</span> im Webhook für bexio{" "}
              <span className="font-mono text-[11px]">article_ids</span>.
            </li>
            <li>
              Positionen: <span className="font-mono text-[11px]">lineItems</span> durchlaufen — in bexio ggf. ein
              Standard-Artikel wählen, wenn keine ID mitkommt.
            </li>
          </ol>
          <p className="mt-2">
            Ohne ID bleibt <span className="font-mono text-[11px]">bexioContactIdNumeric</span> leer — dann Zuordnung
            über Name/E-Mail oder manuell in bexio.
          </p>
        </div>
          </div>
        </details>
        <form action={saveZapierSettingsAction} className="mt-4 grid gap-4">
          <div className="flex items-start gap-3 rounded-md border border-border/60 px-3 py-3">
            <input id="zapierEnabled" name="zapierEnabled" type="checkbox" defaultChecked={zapierEnabled} className="mt-0.5 size-4" />
            <div className="space-y-1">
              <Label htmlFor="zapierEnabled" className="text-sm font-medium">
                Zapier-Integration aktivieren
              </Label>
              <p className="text-xs text-muted-foreground">Nur aktivierte Organisationen senden Events an Zapier.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="zapierWebhookUrl">Zapier Webhook URL (Catch Hook)</Label>
              <Input
                id="zapierWebhookUrl"
                name="zapierWebhookUrl"
                defaultValue={zapierWebhookUrl}
                placeholder="https://hooks.zapier.com/hooks/catch/..."
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="zapierSigningSecret">Signatur-Secret</Label>
              <Input
                id="zapierSigningSecret"
                name="zapierSigningSecret"
                defaultValue={zapierSecret}
                placeholder="zufälliges langes Secret"
              />
            </div>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <div>Letzter Test: {lastTest}</div>
            <div>Inbound-Webhook (für Zapier → BauFlip): {webhookInUrl}</div>
            <div>Letzter Fehler: {org?.zapier_last_error ? String(org.zapier_last_error) : "Kein Fehler"}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={buttonVariants()}>
              Einstellungen speichern
            </button>
            <button formAction={testZapierConnectionAction} className={buttonVariants({ variant: "outline" })}>
              Verbindung testen
            </button>
          </div>
        </form>
      </div>

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

    </section>
  );
}
