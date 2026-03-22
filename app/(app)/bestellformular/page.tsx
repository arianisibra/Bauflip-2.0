import { listSupplierTemplates } from "@/lib/db/repository";
import { SupplierOrderForm } from "@/components/app/supplier-order-form";

export default async function BestellformularPage() {
  const templates = await listSupplierTemplates();
  const template = templates[0];

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Bestellformular</h1>
      <p className="text-sm text-muted-foreground">
        Lieferantenspezifische Pflichtfelder. Abschluss nur mit vollständigen Angaben.
      </p>

      {template ? (
        <div className="rounded-lg border bg-white p-4">
          <SupplierOrderForm projectId="p-1" template={template} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Noch keine Lieferantenvorlage vorhanden.</p>
      )}
    </section>
  );
}
