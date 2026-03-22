import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function IntegrationenPage() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Integrationen</h1>

      <div className="rounded-lg border bg-white p-4">
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

      <div className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-medium">Stoffgenerator</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Externe Stoffauswahl mit Projektbezug.
        </p>
        <Button className="mt-3" nativeButton={false} render={<Link href="https://www.sonnentuch.ch/produkte-und-informationen/stoffe-und-dessins/stoffgenerator" target="_blank" />}>
          Stoffgenerator öffnen
        </Button>
      </div>
    </section>
  );
}
