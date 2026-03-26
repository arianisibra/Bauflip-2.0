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
  day: number;
  view: "month" | "week" | "day";
  appointments: CalendarAppointmentItem[];
};

export function TermineCalendarClient({ year, month, day, view, appointments }: Props) {
  const byDay = useMemo(() => groupByDay(appointments), [appointments]);

  const selected = new Date(year, month - 1, day);
  const first = new Date(year, month - 1, 1);
  const lastMonthDay = new Date(year, month, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= lastMonthDay; d++) {
    cells.push(d);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  while (cells.length < 42) {
    cells.push(null);
  }

  const navDate = new Date(selected);
  if (view === "month") {
    navDate.setDate(1);
  }
  const prevDate = new Date(navDate);
  const nextDate = new Date(navDate);
  if (view === "day") {
    prevDate.setDate(prevDate.getDate() - 1);
    nextDate.setDate(nextDate.getDate() + 1);
  } else if (view === "week") {
    prevDate.setDate(prevDate.getDate() - 7);
    nextDate.setDate(nextDate.getDate() + 7);
  } else {
    prevDate.setMonth(prevDate.getMonth() - 1);
    nextDate.setMonth(nextDate.getMonth() + 1);
  }
  const makeHref = (date: Date, nextView: "month" | "week" | "day") =>
    `/termine?y=${date.getFullYear()}&m=${date.getMonth() + 1}&d=${date.getDate()}&v=${nextView}`;

  const weekStart = new Date(selected);
  weekStart.setDate(selected.getDate() - ((selected.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const title =
    view === "day"
      ? new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(selected)
      : view === "week"
        ? `${new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit" }).format(weekStart)} – ${new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }).format(weekEnd)}`
        : new Intl.DateTimeFormat("de-CH", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold capitalize">{title}</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border p-0.5">
            <Link href={makeHref(selected, "month")} className={buttonVariants({ variant: view === "month" ? "default" : "ghost", size: "sm" })}>
              Monat
            </Link>
            <Link href={makeHref(selected, "week")} className={buttonVariants({ variant: view === "week" ? "default" : "ghost", size: "sm" })}>
              Woche
            </Link>
            <Link href={makeHref(selected, "day")} className={buttonVariants({ variant: view === "day" ? "default" : "ghost", size: "sm" })}>
              Tag
            </Link>
          </div>
          <Link
            href={makeHref(prevDate, view)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
            aria-label="Vorheriger Zeitraum"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <Link href={`/termine?v=${view}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Heute
          </Link>
          <Link
            href={makeHref(nextDate, view)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
            aria-label="Nächster Zeitraum"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>

      {view === "month" ? (
        <div className="grid grid-cols-7 gap-px rounded-lg border bg-border text-center text-xs font-medium">
          {weekdayLabels.map((w) => (
            <div key={w} className="bg-muted/50 px-1 py-2">
              {w}
            </div>
          ))}
          {cells.map((cellDay, i) => {
            if (cellDay === null) {
              return <div key={`e-${i}`} className="min-h-[72px] bg-muted/10" />;
            }
            const date = new Date(year, month - 1, cellDay);
            const key = dayKey(date);
            const list = byDay.get(key) ?? [];
            const isToday = new Date().toDateString() === date.toDateString();
            return (
              <div
                key={key}
                className={cn(
                  "flex min-h-[72px] flex-col gap-0.5 border-t bg-card p-1 text-left text-[11px] leading-tight",
                  isToday && "ring-1 ring-primary/50",
                )}
              >
                <span className={cn("tabular-nums text-muted-foreground", isToday && "font-semibold text-primary")}>
                  {cellDay}
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
                  {list.length > 3 ? <span className="text-[10px] text-muted-foreground">+{list.length - 3} weitere</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : view === "week" ? (
        <div className="grid gap-2">
          {Array.from({ length: 7 }).map((_, idx) => {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + idx);
            const key = dayKey(date);
            const list = byDay.get(key) ?? [];
            const isToday = new Date().toDateString() === date.toDateString();
            return (
              <div key={key} className={cn("rounded-md border bg-card p-3", isToday && "ring-1 ring-primary/50")}>
                <p className="mb-2 text-sm font-medium">
                  {new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "2-digit", month: "2-digit" }).format(date)}
                </p>
                {list.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Keine Termine</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {list.map((a) => (
                      <Link
                        key={a.id}
                        href={`/projekte/${a.projectId}`}
                        className="rounded px-2 py-1 text-xs text-white hover:opacity-90"
                        style={{ backgroundColor: a.calendarColor }}
                      >
                        {new Date(a.startsAt).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })} · {a.projectTitle}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-3">
          <p className="mb-3 text-sm font-medium">
            {new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(selected)}
          </p>
          {(byDay.get(dayKey(selected)) ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Termine für diesen Tag.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {(byDay.get(dayKey(selected)) ?? []).map((a) => (
                <Link
                  key={a.id}
                  href={`/projekte/${a.projectId}`}
                  className="rounded-md px-3 py-2 text-sm text-white hover:opacity-90"
                  style={{ backgroundColor: a.calendarColor }}
                >
                  {new Date(a.startsAt).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })} · {a.projectTitle}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
