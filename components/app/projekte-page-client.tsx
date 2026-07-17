"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { todayKeySwiss } from "@/lib/date/swiss";
import { sanitizeAppReturnTo } from "@/lib/navigation/app-return-to";
import {
  buildKalenderSheetHref,
  parseAdminCalendarUrlState,
} from "@/lib/navigation/admin-calendar-navigation";
import { ProjekteListClient } from "@/components/app/projekte-list-client";

export function ProjektePageClient({
  supabaseConfigured,
  isAdmin,
}: {
  supabaseConfigured: boolean;
  isAdmin: boolean;
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
      <ProjekteListClient
        canEditProjectSheet
        isAdmin={isAdmin}
        initialOpenProjectId={openProjectId}
        initialOpenSource={openSource}
        initialReturnTo={returnTo}
      />
    </section>
  );
}
