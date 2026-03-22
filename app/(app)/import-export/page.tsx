import Link from "next/link";
import { importCsvAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ImportExportPage() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Import / Export</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <form action={importCsvAction} className="rounded-lg border bg-white p-4">
          <h2 className="text-lg font-medium">CSV Import</h2>
          <div className="mt-3 flex flex-col gap-2">
            <Label htmlFor="type">Datentyp</Label>
            <select id="type" name="type" className="h-10 rounded-lg border border-input px-3">
              <option value="customers">Kunden</option>
              <option value="articles">Artikel</option>
            </select>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <Label htmlFor="csvText">CSV Inhalt</Label>
            <Textarea
              id="csvText"
              name="csvText"
              required
              placeholder="name,email,phone,street,postalCode,city"
              className="min-h-40"
            />
          </div>
          <Button className="mt-4" type="submit">
            CSV importieren
          </Button>
        </form>

        <div className="rounded-lg border bg-white p-4">
          <h2 className="text-lg font-medium">CSV Export</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Kundenstamm und Artikel können direkt als CSV exportiert werden.
          </p>
          <div className="mt-4 flex gap-2">
            <Button nativeButton={false} render={<Link href="/api/export/customers" />}>
              Kunden exportieren
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/api/export/articles" />}>
              Artikel exportieren
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
