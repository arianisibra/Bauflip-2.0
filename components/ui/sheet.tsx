"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Klicks auf portalierte Inhalte (z. B. Base-UI-Select) liegen ausserhalb von Dialog.Content —
 * ohne preventDefault schliesst Radix den Dialog bzw. blockiert die Interaktion.
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
      target.closest('[data-base-ui-portal]') ||
      target.closest('[role="listbox"]') ||
      target.closest('[role="option"]'),
  );
}

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** z. B. Link zur Vollansicht */
  side?: "right" | "left";
  /** z. B. `max-w-xl` für breitere Formulare */
  className?: string;
};

export function Sheet({ open, onOpenChange, title, description, children, footer, side = "right", className }: SheetProps) {
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
    // modal={false}: sonst fängt Radix den Fokus im Panel — Base-UI-Select rendert die Liste per Portal
    // im body; der Fokus springt zurück und das Dropdown klappt sofort wieder zu.
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal>
        {/* Bei modal={false} rendert Radix kein Overlay — Backdrop manuell (wie zuvor visuell). */}
        <div className="pointer-events-auto fixed inset-0 z-50 bg-black/40" aria-hidden />
        <Dialog.Content
          className={cn(
            "fixed top-0 z-50 flex h-full w-full max-w-lg flex-col border bg-background shadow-xl outline-none",
            side === "left" ? "left-0 border-r" : "right-0 border-l",
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
              <Dialog.Title className="text-xl font-semibold leading-snug tracking-tight">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1.5 text-sm leading-snug text-muted-foreground">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              type="button"
              className="mt-0.5 shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              aria-label="Schliessen"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5 [scrollbar-gutter:stable]">{children}</div>
          {footer ? <div className="border-t border-border/80 bg-muted/20 px-5 py-4">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
