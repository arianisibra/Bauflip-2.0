import { notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { OrderFormTemplatesAdmin } from "@/components/app/order-form-templates-admin";
import { listOrderFormTemplatesForOrg } from "@/lib/db/repository";

export default async function BestellformularePage() {
  const session = await getCurrentSession();
  if (!session || session.role !== "admin" || !session.organizationId) {
    notFound();
  }

  const templates = await listOrderFormTemplatesForOrg(session.organizationId);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Bestellformular-CMS
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Bestellformulare für Lieferanten konfigurieren. Nur Administratoren haben Zugriff.
          </p>
        </div>
      </div>

      <OrderFormTemplatesAdmin templates={templates} />
    </section>
  );
}
