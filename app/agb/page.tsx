import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = {
  title: "Nutzungsbedingungen — Bauflip",
};

export default function AgbPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="mb-8 inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Zurück zur Startseite
        </Link>

        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">
          Allgemeine Nutzungsbedingungen
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Stand: 22.07.2026
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="mb-1.5 font-semibold">1. Geltungsbereich</h2>
            <p>
              Diese Nutzungsbedingungen gelten für die Nutzung der Software Bauflip
              («Dienstleistung») durch registrierte Organisationen («Kunde») und deren
              Mitarbeitende. Anbieterin ist Velixar, Lindenstrasse 12, 8604 Volketswil, Schweiz.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 font-semibold">2. Vertragsgegenstand</h2>
            <p>
              Bauflip stellt dem Kunden eine webbasierte Software zur Verwaltung von
              Kundenaufträgen, Terminen, Offerten, Rapporten und Rechnungen zur Verfügung
              (Software-as-a-Service). Der Funktionsumfang richtet sich nach dem jeweils gültigen
              Angebot bzw. Vertrag.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 font-semibold">3. Konto und Pflichten des Kunden</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Zugangsdaten sind vertraulich zu behandeln und nicht an Dritte weiterzugeben.</li>
              <li>
                Der Kunde ist für die Richtigkeit der in Bauflip erfassten Daten sowie für die
                Einhaltung seiner eigenen datenschutzrechtlichen Pflichten gegenüber seinen
                Endkund:innen verantwortlich.
              </li>
              <li>
                Die missbräuchliche Nutzung (z. B. Hochladen rechtswidriger Inhalte) ist
                untersagt.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-1.5 font-semibold">4. Verfügbarkeit</h2>
            <p>
              Wir bemühen uns um eine hohe Verfügbarkeit der Dienstleistung, garantieren jedoch
              keine unterbrechungsfreie Nutzung. Wartungsarbeiten werden nach Möglichkeit
              vorangekündigt. Es bestehen keine vertraglich zugesicherten Verfügbarkeits- oder
              Reaktionszeiten (kein SLA).
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 font-semibold">5. Haftung</h2>
            <p>
              Die Haftung für leichte Fahrlässigkeit wird, soweit gesetzlich zulässig,
              ausgeschlossen. Für Datenverlust haften wir nicht, soweit der Kunde zumutbare
              eigene Sicherungsmassnahmen unterlassen hat.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 font-semibold">6. Datenschutz</h2>
            <p>
              Die Bearbeitung von Personendaten richtet sich nach unserer{" "}
              <Link href="/datenschutz" className="underline underline-offset-2">
                Datenschutzerklärung
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 font-semibold">7. Laufzeit und Kündigung</h2>
            <p>
              Der Vertrag läuft auf unbestimmte Zeit bei einer Mindestlaufzeit von einem Jahr ab
              Vertragsbeginn. Er verlängert sich danach automatisch um jeweils ein weiteres Jahr,
              sofern er nicht mit einer Frist von drei Monaten auf das Ende der laufenden
              Vertragsperiode gekündigt wird.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 font-semibold">8. Änderungen dieser Bedingungen</h2>
            <p>
              Wir können diese Bedingungen mit angemessener Vorankündigung anpassen. Bei
              wesentlichen Änderungen informieren wir den Kunden vorab.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 font-semibold">9. Anwendbares Recht und Gerichtsstand</h2>
            <p>
              Es gilt schweizerisches Recht. Gerichtsstand ist Zürich.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
