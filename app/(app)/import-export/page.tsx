import { CsvImportSection } from "@/components/app/csv-import-section";

export default function ImportExportPage() {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Import / Export</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kontakte und Artikel im CSV-Format: zuerst die Vorlage laden, ausfüllen und wieder hochladen. Export nutzt dieselben
          Spalten wie die Vorlage.
        </p>
      </div>

      <div id="kontakte-import" className="scroll-mt-6">
        <CsvImportSection
          type="contacts"
          title="Kontakte"
          templateHref="/api/import-export/template/contacts"
          exportHref="/api/export/contacts"
          hint="partyKind: «firma» oder «privat». category: «kunde», «lieferant», «partner», «sonstiges». Pro Zeile ist mindestens «name» erforderlich."
        />
      </div>

      <div id="artikel-import" className="scroll-mt-6">
        <CsvImportSection
          type="articles"
          title="Artikel"
          templateHref="/api/import-export/template/articles"
          exportHref="/api/export/articles"
          hint="categoryName: bestehende Kategorie oder neue (wird angelegt). name und sku sind Pflicht. Gleiche sku aktualisiert den Artikel (Upsert)."
        />
      </div>
    </section>
  );
}
