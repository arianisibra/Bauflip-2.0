"use client";

import { useMemo, useState } from "react";
import { TimeEntriesManager } from "@/components/app/time-entries-manager";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useOrgTimeEntries } from "@/lib/query/hooks";
import { todayKeySwiss } from "@/lib/date/swiss";
import type { TimeEntry } from "@/lib/domain/types";

function currentMonthRange(): { start: string; end: string } {
  const todayKey = todayKeySwiss();
  const [y, m] = todayKey.split("-").map(Number);
  const lastDay = new Date(y!, m!, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return { start: `${y}-${pad(m!)}-01`, end: `${y}-${pad(m!)}-${pad(lastDay)}` };
}

/** Seite ist ohnehin admin/office-only (page.tsx-Guard) — beide Rollen sehen auch die Team-Übersicht. */
export function ZeiterfassungPageClient() {
  const [tab, setTab] = useState<"mine" | "team">("mine");

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Zeiterfassung</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Arbeitszeit erfassen und einsehen.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setTab("mine")}
            className={cn(
              "rounded px-2.5 py-1 font-medium transition-colors",
              tab === "mine" ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            Meine Zeit
          </button>
          <button
            type="button"
            onClick={() => setTab("team")}
            className={cn(
              "rounded px-2.5 py-1 font-medium transition-colors",
              tab === "team" ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            Team-Übersicht
          </button>
        </div>
      </div>

      {tab === "mine" ? <TimeEntriesManager /> : <TeamOverview />}
    </section>
  );
}

function TeamOverview() {
  const [{ start, end }, setRange] = useState(() => currentMonthRange());
  const { data: entries = [], isFetching } = useOrgTimeEntries(start, end);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const byUser = useMemo(() => {
    const map = new Map<string, { userDisplayName: string | null; entries: TimeEntry[]; totalHours: number }>();
    for (const entry of entries) {
      const existing = map.get(entry.userId) ?? {
        userDisplayName: entry.userDisplayName,
        entries: [],
        totalHours: 0,
      };
      existing.entries.push(entry);
      existing.totalHours += entry.hours;
      map.set(entry.userId, existing);
    }
    return Array.from(map.entries())
      .map(([userId, v]) => ({ userId, ...v }))
      .sort((a, b) => (a.userDisplayName ?? "").localeCompare(b.userDisplayName ?? "", "de-CH"));
  }, [entries]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="teamRangeStart" className="text-[11px] text-muted-foreground">
            Von
          </Label>
          <Input
            id="teamRangeStart"
            type="date"
            value={start}
            onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="teamRangeEnd" className="text-[11px] text-muted-foreground">
            Bis
          </Label>
          <Input
            id="teamRangeEnd"
            type="date"
            value={end}
            onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
            className="h-8 text-xs"
          />
        </div>
        <button
          type="button"
          onClick={() => setRange(currentMonthRange())}
          className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium hover:bg-muted/40"
        >
          Dieser Monat
        </button>
      </div>

      {isFetching && entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">Lädt …</p>
      ) : byUser.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/60 px-3 py-3 text-xs text-muted-foreground">
          Keine Einträge in diesem Zeitraum.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {byUser.map((u) => {
            const expanded = expandedUserId === u.userId;
            return (
              <li key={u.userId} className="rounded-lg border border-border/60 bg-card shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpandedUserId(expanded ? null : u.userId)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                >
                  <span className="text-sm font-semibold text-foreground">
                    {u.userDisplayName ?? "Unbekannt"}
                  </span>
                  <span className="rounded-md bg-primary/10 px-1.5 py-0 text-[10px] font-medium text-primary">
                    {u.totalHours.toFixed(2)} Std.
                  </span>
                </button>
                {expanded ? (
                  <ul className="space-y-1 border-t border-border/60 px-3 py-2">
                    {[...u.entries]
                      .sort((a, b) => b.entryDate.localeCompare(a.entryDate))
                      .map((e) => (
                        <li key={e.id} className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {e.entryDate}
                            {e.startsAt && e.endsAt ? ` · ${e.startsAt}–${e.endsAt}` : ""}
                            {e.note ? ` — ${e.note}` : ""}
                          </span>
                          <span className="shrink-0 font-medium text-foreground">{e.hours} Std.</span>
                        </li>
                      ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
