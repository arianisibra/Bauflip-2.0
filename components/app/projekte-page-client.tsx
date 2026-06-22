"use client";

import { useSearchParams } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { sanitizeAppReturnTo } from "@/lib/navigation/app-return-to";
import { ProjekteListClient } from "@/components/app/projekte-list-client";

export function ProjektePageClient({
  supabaseConfigured,
}: {
  supabaseConfigured: boolean;
}) {
  const searchParams = useSearchParams();
  const rawOpen =
    (searchParams.get("openProjectId") ?? "").trim() ||
    (searchParams.get("sheet") ?? "").trim();
  const openSource = searchParams.get("from") === "kalender" ? "kalender" : undefined;
  const returnTo = sanitizeAppReturnTo(searchParams.get("returnTo"));
  const openProjectId = rawOpen || undefined;

  return (
    <section className="flex flex-col gap-4">
      {!supabaseConfigured ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-4 shrink-0" />
            Supabase ist nicht konfiguriert. Es werden Demo-Daten verwendet.
          </div>
        </div>
      ) : null}
      <ProjekteListClient
        canEditProjectSheet
        initialOpenProjectId={openProjectId}
        initialOpenSource={openSource}
        initialReturnTo={returnTo}
      />
    </section>
  );
}
