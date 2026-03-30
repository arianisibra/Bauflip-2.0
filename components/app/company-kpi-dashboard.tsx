import type { ReactNode } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { CompanyKpiRevenueLineChart } from "@/components/app/company-kpi-revenue-line-chart";
import type { CompanyKpiSnapshot } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { TrendingUp, Users } from "lucide-react";

function chf(n: number) {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(n);
}

type StatProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
};

function StatTile({ label, value, hint, icon }: StatProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground/90 [&_svg]:size-3.5">{icon}</span> : null}
      </div>
      <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      {hint ? <p className="text-xs leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Inhalt ohne äußere Card — für das konfigurierbare Dashboard. */
export function CompanyKpiDashboardContent({ kpis }: { kpis: CompanyKpiSnapshot }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile
          label="Umsatz"
          value={chf(kpis.revenueApprovedChf)}
          icon={<TrendingUp />}
        />
        <StatTile label="Kontakte" value={String(kpis.contactsCount)} icon={<Users />} />
        <StatTile
          label="Aktive Projekte"
          value={String(kpis.activeProjectsCount)}
          hint={`${kpis.completedProjectsCount} abgeschlossen gesamt.`}
        />
      </div>

      <CompanyKpiRevenueLineChart />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <StatTile
          label="Offene Rechnungen"
          value={String(kpis.openInvoicesCount)}
        />
        <StatTile
          label="Termine diese Woche"
          value={String(kpis.appointmentsThisWeekCount)}
          hint="Kalenderwoche, nach Startzeit."
        />
      </div>
    </div>
  );
}

export function CompanyKpiDashboard({ kpis }: { kpis: CompanyKpiSnapshot }) {
  return (
    <Card className="xl:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Betrieb &amp; Erfolg</CardTitle>
          <CardDescription>Umsatz und Kennzahlen.</CardDescription>
        </div>
        <Link href="/projekte" className={cn(buttonVariants({ variant: "ghost" }), "shrink-0")}>
          Alle Projekte
        </Link>
      </CardHeader>
      <CardContent>
        <CompanyKpiDashboardContent kpis={kpis} />
      </CardContent>
    </Card>
  );
}
