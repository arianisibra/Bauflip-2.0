import Image from "next/image";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const LOGO_ON_LIGHT = "/Bauflip_Logo_Kurz-removebg_black.png";
const LOGO_ON_DARK = "/Bauflip_Logo-removebg_white.png";

export type BauflipLoadingProps = {
  /** Kurzer Hinweis unter dem Logo */
  label?: string;
  size?: "sm" | "md" | "lg";
  /** Logo-Kontrast: heller Hintergrund (Standard) oder dunkel (z. B. Sidebar) */
  tone?: "light" | "dark";
  className?: string;
};

const sizeStyles = {
  sm: { outer: "h-16 w-16", logo: 40, img: "size-10" },
  md: { outer: "h-24 w-24", logo: 56, img: "size-14" },
  lg: { outer: "h-32 w-32", logo: 72, img: "size-[4.5rem]" },
};

/**
 * Zentrierter Ladezustand mit Bauflip-Logo und Primary-Spin-Ring — für Sheets, Charts, Routen.
 */
export function BauflipLoading({
  label = "Wird geladen …",
  size = "md",
  tone = "light",
  className,
}: BauflipLoadingProps) {
  const logo = tone === "dark" ? LOGO_ON_DARK : LOGO_ON_LIGHT;
  const s = sizeStyles[size];

  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className={cn("relative flex items-center justify-center", s.outer)}>
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary shadow-[0_0_0_1px_rgba(0,0,0,0.04)]" />
        <div className="absolute inset-[5px] rounded-full bg-primary/[0.07]" />
        <div className="relative flex items-center justify-center rounded-full bg-card p-2 shadow-sm ring-1 ring-border/70">
          <Image
            src={logo}
            alt=""
            width={s.logo}
            height={s.logo}
            className={cn(s.img, "object-contain")}
            unoptimized
          />
        </div>
      </div>
      {label ? <p className="text-center text-sm font-medium text-muted-foreground">{label}</p> : null}
    </div>
  );
}

export type BauflipLoadingButtonLabelProps = {
  children: ReactNode;
  /**
   * `onPrimary`: Primär-Button (Orange, Tinte-Schrift) — dunkles Logo + Tinte-Spinner.
   * `onSurface`: Outline/Sekundär/heller Hintergrund, dunkles Logo + Primary-Spinner.
   */
  variant?: "onPrimary" | "onSurface";
};

/**
 * Inhalt für Submit-Buttons während eine Aktion läuft (Logo + Spinner + Text).
 */
export function BauflipLoadingButtonLabel({ children, variant = "onPrimary" }: BauflipLoadingButtonLabelProps) {
  const logo = LOGO_ON_LIGHT;
  const spinnerClass = variant === "onPrimary" ? "text-primary-foreground" : "text-primary";

  return (
    <span className="inline-flex items-center justify-center gap-2">
      <span className="relative size-4 shrink-0 overflow-hidden rounded-sm opacity-95">
        <Image src={logo} alt="" width={16} height={16} className="size-full object-contain" unoptimized />
      </span>
      <Loader2 className={cn("size-4 shrink-0 animate-spin", spinnerClass)} aria-hidden />
      <span>{children}</span>
    </span>
  );
}

export type BauflipLoadingInlineProps = {
  label: string;
  className?: string;
};

/**
 * Kompakte Zeile für Fließtext (z. B. „Speichern …“ neben Toolbar) — Logo + Spinner + Label.
 */
export function BauflipLoadingInline({ label, className }: BauflipLoadingInlineProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-xs text-muted-foreground", className)}
      role="status"
      aria-live="polite"
    >
      <span className="relative size-4 shrink-0 opacity-90">
        <Image src={LOGO_ON_LIGHT} alt="" width={16} height={16} className="size-full object-contain" unoptimized />
      </span>
      <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden />
      <span>{label}</span>
    </span>
  );
}
