"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AdminCalendar } from "@/components/app/admin-calendar";
import { KalenderProjectSheet } from "@/components/app/kalender-project-sheet";
import { KalenderSheetProvider } from "@/components/app/kalender-sheet-context";

function KalenderPageContent({ serverNowTs }: { serverNowTs: number }) {
  const searchParams = useSearchParams();
  const initialSheet = (searchParams.get("sheet") ?? "").trim() || null;

  return (
    <KalenderSheetProvider initialSheetProjectId={initialSheet}>
      <section className="flex flex-col gap-6">
        <div className="space-y-1 border-b border-border/60 pb-4">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Kalender
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Termine nach Monat, Kalenderwoche oder einzelnem Tag (Europe/Zurich).
          </p>
        </div>
        <AdminCalendar serverNowTs={serverNowTs} />
      </section>
      <KalenderProjectSheet />
    </KalenderSheetProvider>
  );
}

export function KalenderPageClient({ serverNowTs }: { serverNowTs: number }) {
  return (
    <Suspense fallback={null}>
      <KalenderPageContent serverNowTs={serverNowTs} />
    </Suspense>
  );
}
