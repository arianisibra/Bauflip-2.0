"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Zeile mit Icon — Wert steht im Vordergrund, kein separates Großbuchstaben-Label. */
export function SheetDetailRow({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border border-border/70 bg-muted/25 px-3 py-2.5 dark:bg-muted/15",
        className,
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm ring-1 ring-border/50">
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 text-sm leading-snug [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline">
        {children}
      </div>
    </div>
  );
}

export function SheetDetailStack({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-2.5", className)}>{children}</div>;
}

/** Optionale Gruppe mit dezentem Titel (Satzfall, nicht GROSSBUCHSTABEN). */
export function SheetDetailGroup({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {title ? <p className="text-xs font-medium text-muted-foreground">{title}</p> : null}
      {children}
    </div>
  );
}

/** Hervorgehobener Textblock (z. B. Anfrage-Auszug). */
export function SheetDetailQuote({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <blockquote className={cn("rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm leading-relaxed", className)}>
      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{children}</p>
    </blockquote>
  );
}

/** Fliesstext in abgerundetem Rahmen (Beschreibungen). */
export function SheetDetailProse({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-muted/15 px-4 py-3 text-sm leading-relaxed text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Kompakte Kennzahl (z. B. Preis). */
export function SheetMetric({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5 dark:bg-muted/15",
        align === "right" && "text-right",
      )}
    >
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
