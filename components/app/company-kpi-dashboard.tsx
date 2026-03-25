import type { ReactNode } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { CompanyKpiRevenueLineChart } from "@/components/app/company-kpi-revenue-line-chart";
import type { CompanyKpiSnapshot } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { Database, Percent, TrendingUp, Users, Wallet } from "lucide-react";

function chf(n: number) {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(n);
}

function pct(n: number | null) {
  if (n === null) {
    return "—";
  }
  return `${n} %`;
}

type StatProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
};

function StatTile({ label, value, hint, icon }: StatProps) {
  return (
    <div className="flex min-w-[9.5rem] flex-1 flex-col gap-1.5 rounded-lg border bg-muted/25 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground [&_svg]:size-4">{icon}</span> : null}
      </div>
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      {hint ? <p className="text-sm leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Inhalt ohne äußere Card — für das konfigurierbare Dashboard. */
export function CompanyKpiDashboardContent({ kpis }: { kpis: CompanyKpiSnapshot }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <StatTile
          label="Umsatz (genehmigt)"
          value={chf(kpis.revenueApprovedChf)}
          hint="Summe Positionen × Preis bei Status «genehmigt»."
          icon={<TrendingUp />}
        />
        <StatTile
          label="Deckungsbeitrag (Plan)"
          value={chf(kpis.estimatedGrossContributionChf)}
          hint="ca. 34 % vom Umsatz (Plan); ohne Einkauf in der Datenbank."
          icon={<Wallet />}
        />
        <StatTile label="Kontakte" value={String(kpis.contactsCount)} icon={<Users />} />
        <StatTile
          label="Aktive Projekte"
          value={String(kpis.activeProjectsCount)}
          hint={`${kpis.completedProjectsCount} abgeschlossen gesamt.`}
        />
      </div>

      <CompanyKpiRevenueLineChart />

      <div className="flex flex-wrap gap-2">
        <StatTile
          label="Offene Rechnungen"
          value={String(kpis.openInvoicesCount)}
          hint="Noch nicht «bezahlt»."
        />
        <StatTile
          label="Offerte → Abschluss"
          value={pct(kpis.quoteWinRatePercent)}
          hint={
            kpis.quotesDecidedCount > 0
              ? `Bei ${kpis.quotesDecidedCount} entschiedenen Offerten (ja/nein).`
              : "Noch keine entschiedenen Offerten."
          }
          icon={<Percent />}
        />
        <StatTile
          label="Termine diese Woche"
          value={String(kpis.appointmentsThisWeekCount)}
          hint="Kalenderwoche, nach Startzeit."
        />
        <StatTile
          label="Bestellungen unterwegs"
          value={String(kpis.purchaseOrdersInTransit)}
          hint="Status gesendet oder bestätigt, noch nicht geliefert."
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-sm leading-relaxed text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Database className="size-4 shrink-0 opacity-80" />
          Datenbank: {kpis.supabaseConnected ? "verbunden (Live)" : "Mock / offline"}
        </span>
        <span className="hidden sm:inline">·</span>
        <span>
          Technik: Kennzahlen aus Projekten, Offerten, Rechnungen und Einkauf — für operative Steuerung, nicht für
          die Jahresrechnung.
        </span>
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
          <CardDescription>
            Umsatz aus genehmigten Offerten, Planungs-Deckungsbeitrag, Kunden und Pipeline — relevant für
            Storenbau &amp; Montage.
          </CardDescription>
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
