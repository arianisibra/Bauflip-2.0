"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { fetchAbrechnungExportAction } from "@/app/(app)/projekte/export-actions";
import { downloadCsv } from "@/lib/csv/download";
import { todayKeySwiss } from "@/lib/date/swiss";
import { sanitizeAppReturnTo } from "@/lib/navigation/app-return-to";
import {
  buildKalenderSheetHref,
  parseAdminCalendarUrlState,
} from "@/lib/navigation/admin-calendar-navigation";
import { ProjekteListClient } from "@/components/app/projekte-list-client";

export function ProjektePageClient({
  supabaseConfigured,
}: {
  supabaseConfigured: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawOpen =
    (searchParams.get("openProjectId") ?? "").trim() ||
    (searchParams.get("sheet") ?? "").trim();
  const openSource = searchParams.get("from") === "kalender" ? "kalender" : undefined;
  const returnTo = sanitizeAppReturnTo(searchParams.get("returnTo"));
  const openProjectId = rawOpen || undefined;

  useEffect(() => {
    if (searchParams.get("from") !== "kalender" || !rawOpen) return;
    const safeReturn = sanitizeAppReturnTo(searchParams.get("returnTo"));
    if (safeReturn?.startsWith("/kalender")) {
      const qs = safeReturn.includes("?") ? safeReturn.split("?")[1] ?? "" : "";
      const params = new URLSearchParams(qs);
      params.set("sheet", rawOpen);
      router.replace(`/kalender?${params.toString()}`);
      return;
    }
    router.replace(
      buildKalenderSheetHref(
        rawOpen,
        parseAdminCalendarUrlState(
          { get: () => null },
          todayKeySwiss(),
        ),
      ),
    );
  }, [rawOpen, router, searchParams]);

  if (openSource === "kalender" && rawOpen) {
    return null;
  }

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
      <div className="flex justify-end">
        <AbrechnungExportButton />
      </div>
      <ProjekteListClient
        canEditProjectSheet
        initialOpenProjectId={openProjectId}
        initialOpenSource={openSource}
        initialReturnTo={returnTo}
      />
    </section>
  );
}

/** Exportiert alle Projekte im Status «abrechnen» als CSV (inkl. Rapportzeit + Offerte). */
function AbrechnungExportButton() {
  const [exporting, setExporting] = useState(false);

  return (
    <button
      type="button"
      disabled={exporting}
      onClick={async () => {
        setExporting(true);
        try {
          const rows = await fetchAbrechnungExportAction();
          if (rows.length === 0) {
            toast.info("Keine Projekte im Status «Abrechnen».");
            return;
          }
          downloadCsv(`abrechnungs-export-${todayKeySwiss()}`, rows.map((r) => ({
            "Projekt-Nr.": r.referenceCode ?? "",
            Titel: r.title,
            Mieter: r.tenantName ?? "",
            Telefon: r.tenantPhone ?? "",
            "E-Mail": r.tenantEmail ?? "",
            Adresse: r.address,
            "Erstellt am": r.createdAt
              ? new Date(r.createdAt).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })
              : "",
            "Rapportzeit (Std.)": Math.round((r.reportMinutes / 60) * 100) / 100,
            Offerte: r.approvedQuoteNumber ?? "",
            "Offerte Total (CHF)": r.approvedQuoteGross ?? "",
          })));
          toast.success(`${rows.length} Projekte exportiert`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Export fehlgeschlagen.");
        } finally {
          setExporting(false);
        }
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-50"
    >
      <Download className="size-3.5" aria-hidden />
      {exporting ? "Exportiert …" : "Abrechnungs-Export (CSV)"}
    </button>
  );
}
