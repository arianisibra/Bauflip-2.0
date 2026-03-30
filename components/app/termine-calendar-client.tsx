"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { CalendarAppointmentItem } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { buttonVariants } from "@/components/ui/button-variants";
import { Calendar, ChevronLeft, ChevronRight, Clock, ExternalLink, User } from "lucide-react";

const weekdayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const kindLabel: Record<CalendarAppointmentItem["kind"], string> = {
  besichtigung: "Besichtigung",
  ausfuehrung: "Ausführung",
};

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

function formatDetailSubtitle(a: CalendarAppointmentItem) {
  const s = new Date(a.startsAt);
  const e = new Date(a.endsAt);
  const date = new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(s);
  const t0 = new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit" }).format(s);
  const t1 = new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit" }).format(e);
  return `${kindLabel[a.kind]} · ${date} · ${t0}–${t1}`;
}

type Props = {
  year: number;
  month: number;
  day: number;
  view: "month" | "week" | "day";
  appointments: CalendarAppointmentItem[];
};

function AppointmentChip({
  a,
  compact,
  onSelect,
}: {
  a: CalendarAppointmentItem;
  compact?: boolean;
  onSelect: (item: CalendarAppointmentItem) => void;
}) {
  const time = new Date(a.startsAt).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
  return (
    <button
      type="button"
      onClick={() => onSelect(a)}
      className={cn(
        "w-full truncate rounded-md px-1.5 text-left text-white shadow-sm ring-1 ring-black/10 transition hover:brightness-110 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        compact ? "py-0.5 text-[10px] leading-tight" : "py-1.5 text-xs",
      )}
      style={{ backgroundColor: a.calendarColor }}
      title={`${a.projectTitle} · ${time} · ${kindLabel[a.kind]} — Details anzeigen`}
    >
      {!compact ? (
        <>
          <span className="font-medium tabular-nums opacity-95">{time}</span>
          <span className="mx-1 opacity-60">·</span>
        </>
      ) : null}
      <span className="font-medium">{compact ? `${time} ${a.projectTitle}` : a.projectTitle}</span>
    </button>
  );
}

export function TermineCalendarClient({ year, month, day, view, appointments }: Props) {
  const byDay = useMemo(() => groupByDay(appointments), [appointments]);
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointmentItem | null>(null);
  const sheetOpen = selectedAppointment !== null;

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSelectedAppointment(null);
    }
  }, []);

  const openDetail = useCallback((a: CalendarAppointmentItem) => {
    setSelectedAppointment(a);
  }, []);

  const anchorDate = new Date(year, month - 1, day);
  const first = new Date(year, month - 1, 1);
  const lastMonthDay = new Date(year, month, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) {
    cells.push(null);
  }
  for (let letDay = 1; letDay <= lastMonthDay; letDay++) {
    cells.push(letDay);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  while (cells.length < 42) {
    cells.push(null);
  }

  const navDate = new Date(anchorDate);
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

  const weekStart = new Date(anchorDate);
  weekStart.setDate(anchorDate.getDate() - ((anchorDate.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const title =
    view === "day"
      ? new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(anchorDate)
      : view === "week"
        ? `${new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit" }).format(weekStart)} – ${new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }).format(weekEnd)}`
        : new Intl.DateTimeFormat("de-CH", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold capitalize tracking-tight text-foreground">{title}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-border/60 bg-muted/20 p-0.5 shadow-sm">
              <Link href={makeHref(anchorDate, "month")} className={buttonVariants({ variant: view === "month" ? "default" : "ghost", size: "sm" })}>
                Monat
              </Link>
              <Link href={makeHref(anchorDate, "week")} className={buttonVariants({ variant: view === "week" ? "default" : "ghost", size: "sm" })}>
                Woche
              </Link>
              <Link href={makeHref(anchorDate, "day")} className={buttonVariants({ variant: view === "day" ? "default" : "ghost", size: "sm" })}>
                Tag
              </Link>
            </div>
            <div className="flex items-center gap-1">
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
        </div>

        {view === "month" ? (
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border/60 bg-border shadow-sm">
            {weekdayLabels.map((w) => (
              <div key={w} className="bg-muted/40 px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {w}
              </div>
            ))}
            {cells.map((cellDay, i) => {
              if (cellDay === null) {
                return <div key={`e-${i}`} className="min-h-[80px] bg-muted/10" />;
              }
              const date = new Date(year, month - 1, cellDay);
              const key = dayKey(date);
              const list = byDay.get(key) ?? [];
              const isToday = new Date().toDateString() === date.toDateString();
              return (
                <div
                  key={key}
                  className={cn(
                    "flex min-h-[80px] flex-col gap-1 border-t bg-card p-1.5 text-left",
                    isToday && "bg-primary/10 ring-1 ring-inset ring-primary/45 dark:bg-primary/20",
                  )}
                >
                  <Link
                    href={makeHref(date, "day")}
                    className={cn(
                      "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums text-muted-foreground transition hover:bg-muted",
                      isToday && "bg-primary/15 font-semibold text-primary",
                    )}
                  >
                    {cellDay}
                  </Link>
                  <div className="flex min-h-0 flex-1 flex-col gap-0.5">
                    {list.slice(0, 3).map((a) => (
                      <AppointmentChip key={a.id} a={a} compact onSelect={openDetail} />
                    ))}
                    {list.length > 3 ? (
                      <span className="px-0.5 text-[10px] text-muted-foreground">+{list.length - 3} weitere</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : view === "week" ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 7 }).map((_, idx) => {
              const date = new Date(weekStart);
              date.setDate(weekStart.getDate() + idx);
              const key = dayKey(date);
              const list = byDay.get(key) ?? [];
              const isToday = new Date().toDateString() === date.toDateString();
              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-xl border border-border/60 bg-card p-3 shadow-sm ring-1 ring-black/[0.03] transition dark:ring-white/[0.06]",
                    isToday && "ring-2 ring-primary/35",
                  )}
                >
                  <p className="mb-2 text-sm font-semibold text-foreground">
                    {new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "2-digit", month: "2-digit" }).format(date)}
                  </p>
                  {list.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Keine Termine</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {list.map((a) => (
                        <AppointmentChip key={a.id} a={a} onSelect={openDetail} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
            <p className="mb-3 text-sm font-semibold text-foreground">
              {new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(anchorDate)}
            </p>
            {(byDay.get(dayKey(anchorDate)) ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Termine für diesen Tag.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {(byDay.get(dayKey(anchorDate)) ?? []).map((a) => (
                  <AppointmentChip key={a.id} a={a} onSelect={openDetail} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Sheet
        open={sheetOpen}
        onOpenChange={handleOpenChange}
        title={selectedAppointment?.projectTitle ?? "Termin"}
        description={selectedAppointment ? formatDetailSubtitle(selectedAppointment) : undefined}
        footer={
          selectedAppointment ? (
            <div className="flex w-full flex-col gap-2">
              <Link
                href={`/projekte/${selectedAppointment.projectId}`}
                className={cn(buttonVariants({ variant: "default", size: "default" }), "inline-flex w-full items-center justify-center gap-2")}
              >
                Projekt öffnen
                <ExternalLink className="size-4 opacity-90" />
              </Link>
              <Button type="button" variant="outline" className="w-full" onClick={() => handleOpenChange(false)}>
                Schliessen
              </Button>
            </div>
          ) : undefined
        }
      >
        {selectedAppointment ? (
          <div className="flex flex-col gap-5">
            <div
              className="h-2 w-full rounded-full shadow-inner"
              style={{ backgroundColor: selectedAppointment.calendarColor }}
              aria-hidden
            />
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-medium">
                {kindLabel[selectedAppointment.kind]}
              </Badge>
            </div>
            <dl className="grid gap-4 text-sm">
              <div className="flex gap-3">
                <dt className="flex shrink-0 items-center gap-2 text-muted-foreground">
                  <Clock className="size-4 opacity-70" aria-hidden />
                  Zeit
                </dt>
                <dd className="min-w-0 font-medium text-foreground">
                  {new Intl.DateTimeFormat("de-CH", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  }).format(new Date(selectedAppointment.startsAt))}
                  <br />
                  <span className="tabular-nums text-muted-foreground">
                    {new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit" }).format(new Date(selectedAppointment.startsAt))}
                    {" – "}
                    {new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit" }).format(new Date(selectedAppointment.endsAt))}
                  </span>
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="flex shrink-0 items-center gap-2 text-muted-foreground">
                  <User className="size-4 opacity-70" aria-hidden />
                  Zuständig
                </dt>
                <dd className="min-w-0 font-medium text-foreground">
                  {selectedAppointment.technicianName ?? (
                    <span className="font-normal text-muted-foreground">Noch kein Monteur zugewiesen</span>
                  )}
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="flex shrink-0 items-center gap-2 text-muted-foreground">
                  <Calendar className="size-4 opacity-70" aria-hidden />
                  Projekt
                </dt>
                <dd className="min-w-0">
                  <span className="font-medium text-foreground">{selectedAppointment.projectTitle}</span>
                </dd>
              </div>
            </dl>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Tipp: Über «Projekt öffnen» gelangen Sie zu allen Projektinfos, Terminen und dem Team-Chat.
            </p>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}