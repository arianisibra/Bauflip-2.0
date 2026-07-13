"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Zentriertes, fokussiertes Fenster über dem Sheet (mobil Vollbild). Baut auf
 * demselben Radix-Primitive wie das Sheet — inkl. Base-UI-Select-Portal-Handling,
 * damit portalierte Dropdowns (Preisstamm etc.) das Fenster nicht schliessen.
 */
function isPointerOnPortaledSelect(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(
    target.closest('[data-slot="select-content"]') ||
      target.closest('[data-slot="select-trigger"]') ||
      target.closest('[data-slot="select-popup"]') ||
      target.closest('[data-slot="select-positioner"]') ||
      target.closest('[data-slot="select-item"]') ||
      target.closest("[data-base-ui-portal]") ||
      target.closest('[role="listbox"]') ||
      target.closest('[role="option"]'),
  );
}

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** z. B. `max-w-2xl` für breitere Formulare. */
  className?: string;
};

export function Dialog({ open, onOpenChange, title, description, children, footer, className }: DialogProps) {
  React.useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    // modal={false}: wie beim Sheet — sonst fängt Radix den Fokus und portalierte
    // Base-UI-Selects klappen sofort wieder zu.
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPrimitive.Portal>
        <div className="pointer-events-auto fixed inset-0 z-50 bg-black/40" aria-hidden />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-background shadow-xl outline-none",
            // Mobil: Vollbild statt zentriertem Kärtchen.
            "max-sm:inset-0 max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none",
            className,
          )}
          {...(!description ? { "aria-describedby": undefined } : {})}
          onPointerDownOutside={(event) => {
            if (isPointerOnPortaledSelect(event.target)) {
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            if (isPointerOnPortaledSelect(event.target)) {
              event.preventDefault();
            }
          }}
          onFocusOutside={(event) => {
            const next = (event as unknown as FocusEvent).relatedTarget as Element | null;
            if (next && isPointerOnPortaledSelect(next)) {
              event.preventDefault();
            }
          }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border/80 bg-muted/35 px-5 py-4">
            <div className="min-w-0 pr-2">
              <DialogPrimitive.Title className="text-lg font-semibold leading-snug tracking-tight">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-sm leading-snug text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              type="button"
              className="mt-0.5 shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              aria-label="Schliessen"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-5 [scrollbar-gutter:stable]">
            {children}
          </div>
          {footer ? <div className="border-t border-border/80 bg-muted/20 px-5 py-4">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
