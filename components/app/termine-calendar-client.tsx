"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { CalendarAppointmentItem } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";

const weekdayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function dayKey(d: Date) {
  return d.toLocaleDateString("sv-SE");
}

function groupByDay(items: CalendarAppointmentItem[]) {
  const m = new Map<string, CalendarAppointmentItem[]>();
  for (const a of items) {
    const k = dayKey(new Date(a.startsAt));
    const list = m.get(k) ?? [];
    list.push(a);
    m.set(k, list);
  }
  return m;
}

type Props = {
  year: number;
  month: number;
  appointments: CalendarAppointmentItem[];
};

export function TermineCalendarClient({ year, month, appointments }: Props) {
  const byDay = useMemo(() => groupByDay(appointments), [appointments]);

  const first = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= lastDay; d++) {
    cells.push(d);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  while (cells.length < 42) {
    cells.push(null);
  }

  const prev =
    month <= 1
      ? { y: year - 1, m: 12 }
      : { y: year, m: month - 1 };
  const next =
    month >= 12
      ? { y: year + 1, m: 1 }
      : { y: year, m: month + 1 };

  const title = new Intl.DateTimeFormat("de-CH", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold capitalize">{title}</h2>
        <div className="flex items-center gap-1">
          <Link
            href={`/termine?y=${prev.y}&m=${prev.m}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
            aria-label="Vorheriger Monat"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <Link href="/termine" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Heute
          </Link>
          <Link
            href={`/termine?y=${next.y}&m=${next.m}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
            aria-label="Nächster Monat"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-lg border bg-border text-center text-xs font-medium">
        {weekdayLabels.map((w) => (
          <div key={w} className="bg-muted/50 px-1 py-2">
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`e-${i}`} className="min-h-[72px] bg-muted/10" />;
          }
          const date = new Date(year, month - 1, day);
          const key = dayKey(date);
          const list = byDay.get(key) ?? [];
          const isToday =
            new Date().toDateString() === date.toDateString();
          return (
            <div
              key={key}
              className={cn(
                "flex min-h-[72px] flex-col gap-0.5 border-t bg-card p-1 text-left text-[11px] leading-tight",
                isToday && "ring-1 ring-primary/50",
              )}
            >
              <span className={cn("tabular-nums text-muted-foreground", isToday && "font-semibold text-primary")}>
                {day}
              </span>
              <div className="flex flex-col gap-0.5">
                {list.slice(0, 3).map((a) => (
                  <Link
                    key={a.id}
                    href={`/projekte/${a.projectId}`}
                    className="truncate rounded px-0.5 py-0.5 text-[10px] text-white hover:opacity-90"
                    style={{ backgroundColor: a.calendarColor }}
                    title={`${a.projectTitle} · ${new Date(a.startsAt).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}`}
                  >
                    {new Date(a.startsAt).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}{" "}
                    {a.projectTitle}
                  </Link>
                ))}
                {list.length > 3 ? (
                  <span className="text-[10px] text-muted-foreground">+{list.length - 3} weitere</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
