"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { useSessionProfile } from "@/components/app/session-profile-provider";
import { listOrderFormTemplatesForOrgAction } from "@/app/(app)/order-form-template-actions";
import { BauflipLoading } from "@/components/ui/bauflip-loading";
import { queryKeys } from "@/lib/query/keys";

const OrderFormTemplatesAdmin = dynamic(
  () => import("@/components/app/order-form-templates-admin").then((m) => m.OrderFormTemplatesAdmin),
  {
    loading: () => (
      <div className="flex min-h-[14rem] items-center justify-center py-10" role="status" aria-live="polite">
        <BauflipLoading size="sm" label="Formulare werden geladen …" />
      </div>
    ),
  },
);

export function BestellformularePageClient() {
  const profile = useSessionProfile();
  const isAdmin = profile.role === "admin";

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: queryKeys.orderFormTemplates.all(),
    queryFn: () => listOrderFormTemplatesForOrgAction(),
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return null;
  }

  if (templatesLoading || !templates) {
    return (
      <div className="flex justify-center py-16" role="status" aria-live="polite">
        <BauflipLoading size="sm" label="Bestellformulare werden geladen …" />
      </div>
    );
  }

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
