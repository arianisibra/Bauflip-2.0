import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = {
  title: "Datenschutzerklärung — Bauflip",
};

export default function DatenschutzPage() {
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
          Datenschutzerklärung
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Stand: 22.07.2026
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="mb-1.5 font-semibold">1. Verantwortliche Stelle</h2>
            <p>
              Velixar, Lindenstrasse 12, 8604 Volketswil, Schweiz
              <br />
              E-Mail für Datenschutzanfragen: info@velixar.ch
              <br />
              UID: noch nicht vorhanden (Firma noch nicht im Handelsregister eingetragen)
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 font-semibold">2. Zweck der Bearbeitung</h2>
            <p>
              Bauflip ist eine Software, die Handwerksbetrieben hilft, Kundenaufträge, Termine,
              Offerten und Rechnungen zu verwalten. Wir bearbeiten Personendaten ausschliesslich,
              um diese Funktionen für die Organisationen bereitzustellen, die Bauflip nutzen
              («Kunden»). Gegenüber den Endkund:innen der Kunden (z. B. Mieter:innen,
              Verwaltungen) handeln wir als Auftragsbearbeiter im Sinne des Datenschutzgesetzes
              (DSG) — die jeweilige Organisation bleibt verantwortliche Stelle für deren Daten.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 font-semibold">3. Bearbeitete Personendaten</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Kontodaten der Nutzer:innen (Name, E-Mail, Rolle in der Organisation)</li>
              <li>Kundendaten der Organisation (Name, Telefon, E-Mail, Adresse von Mieter:innen/Verwaltungen)</li>
              <li>Auftrags-, Termin- und Rapportdaten (inkl. Fotos, Kundensignatur)</li>
              <li>Zahlungsbezogene Daten für Rechnungen (QR-Referenz, Zahlungseingänge)</li>
              <li>Technische Daten (IP-Adresse, Login-Zeitpunkt, Fehlerprotokolle)</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-1.5 font-semibold">4. Weitergabe an Dritte / Auftragsbearbeiter</h2>
            <p>Zur Erbringung der Dienstleistung setzen wir folgende Anbieter ein:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Supabase</strong> — Datenbank- und Authentifizierungs-Infrastruktur
                (Hosting-Region: Zürich)
              </li>
              <li>
                <strong>Anthropic</strong> — Texterkennung aus hochgeladenen Auftrags-PDFs (nur
                bei aktiver PDF-Import-Funktion, keine dauerhafte Speicherung durch Anthropic)
              </li>
              <li>
                <strong>Hostpoint</strong> — Mailversand für Offerten,
                Terminbestätigungen und Rechnungen
              </li>
              <li>
                <strong>Bexio</strong> — Buchhaltungs-Export, nur wenn vom Kunden aktiviert
              </li>
              <li>
                <strong>Cloudflare</strong> — Bot-Schutz beim Login (Turnstile)
              </li>
            </ul>
            <p className="mt-2">
              Mit allen Anbietern bestehen Auftragsbearbeitungsvereinbarungen bzw. deren
              Standardverträge gelten. Eine Weitergabe an weitere Dritte erfolgt nicht, ausser
              gesetzlich verpflichtend.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 font-semibold">5. Aufbewahrungsdauer</h2>
            <p>
              Personendaten werden so lange aufbewahrt, wie es für die vertraglich vereinbarte
              Nutzung erforderlich ist. Nach Beendigung des Vertrags mit einer Organisation
              werden deren Daten innerhalb eines Monats gelöscht, soweit keine gesetzliche
              Aufbewahrungspflicht entgegensteht (insb. handelsrechtliche Aufbewahrungsfristen für
              Rechnungen, die davon unberührt weitergelten).
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 font-semibold">6. Datensicherheit</h2>
            <p>
              Der Zugriff auf Daten ist pro Organisation technisch isoliert (Row-Level-Security).
              Die Übertragung erfolgt verschlüsselt (TLS). Zugangsdaten zu Drittsystemen (z. B.
              Bexio) sind serverseitig hinterlegt und nicht über die Programmierschnittstelle
              abrufbar.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 font-semibold">7. Rechte der betroffenen Personen</h2>
            <p>
              Nach DSG haben Sie das Recht auf Auskunft, Berichtigung, Löschung und Widerspruch
              bezüglich Ihrer Personendaten. Anfragen zu Kundendaten einer Organisation richten
              Sie bitte direkt an die jeweilige Organisation; Anfragen zu Ihrem eigenen
              Nutzer:innen-Konto an info@velixar.ch.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 font-semibold">8. Änderungen</h2>
            <p>
              Wir können diese Erklärung anpassen, um sie an geänderte Rechtslage oder
              Funktionsumfang anzupassen. Massgebend ist die zum Zeitpunkt Ihres Besuchs gültige
              Fassung.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
