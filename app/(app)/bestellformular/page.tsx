import { redirect } from "next/navigation";
import { BestellformularCmsClient } from "@/components/app/bestellformular-cms-client";
import { getCurrentSession } from "@/lib/auth/session";
import { listSupplierContactNames, listSupplierTemplates } from "@/lib/db/repository";

export default async function BestellformularPage() {
  const session = await getCurrentSession();
  if (!session || (session.role !== "admin" && session.role !== "office")) {
    redirect("/");
  }

  const [templates, supplierNames] = await Promise.all([
    listSupplierTemplates(),
    listSupplierContactNames(),
  ]);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Bestellformular-CMS</h1>
      <p className="text-sm text-muted-foreground">
        Lieferantenspezifische Formulare einfach konfigurieren: Felder, Pflichtfelder, Dropdowns und Reihenfolge.
      </p>
      <BestellformularCmsClient templates={templates} supplierNames={supplierNames} />
    </section>
  );
}
