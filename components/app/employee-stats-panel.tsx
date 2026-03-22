"use client";

import { useMemo, useState } from "react";
import type { EmployeeStat } from "@/lib/domain/types";

type EmployeeStatsPanelProps = {
  stats: EmployeeStat[];
};

export function EmployeeStatsPanel({ stats }: EmployeeStatsPanelProps) {
  const [selectedId, setSelectedId] = useState(stats[0]?.profileId ?? "");
  const selected = useMemo(
    () => stats.find((item) => item.profileId === selectedId) ?? stats[0],
    [selectedId, stats],
  );

  if (!selected) {
    return <p className="text-sm text-muted-foreground">Noch keine Mitarbeiterdaten vorhanden.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-w-xs flex-col gap-2">
        <label htmlFor="employeeSelect" className="text-sm font-medium">
          Mitarbeiter auswählen
        </label>
        <select
          id="employeeSelect"
          value={selected.profileId}
          onChange={(event) => setSelectedId(event.target.value)}
          className="h-10 rounded-lg border border-input bg-white px-3 text-sm"
        >
          {stats.map((item) => (
            <option key={item.profileId} value={item.profileId}>
              {item.profileName}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground">Offene Projekte</p>
          <p className="text-xl font-semibold">{selected.offeneProjekte}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground">Heute erledigt</p>
          <p className="text-xl font-semibold">{selected.abgeschlosseneHeute}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground">Rapporte offen</p>
          <p className="text-xl font-semibold">{selected.offeneRapporte}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground">Stunden Woche</p>
          <p className="text-xl font-semibold">{selected.stundenDieseWoche}</p>
        </div>
      </div>
    </div>
  );
}
