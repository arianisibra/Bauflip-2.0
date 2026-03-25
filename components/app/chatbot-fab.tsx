"use client";

import { useState } from "react";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ChatbotFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed right-6 bottom-6 z-50 flex flex-col items-end">
      <div
        id="bauflip-assistent-panel"
        inert={open ? undefined : true}
        className={cn(
          "pointer-events-none absolute bottom-full right-0 mb-2 w-[min(calc(100vw-3rem),22rem)] origin-bottom-right rounded-2xl border border-cyan-200/40 bg-gradient-to-b from-card to-cyan-50/40 p-4 shadow-xl shadow-cyan-950/10 ring-1 ring-cyan-500/10 backdrop-blur-sm transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none dark:border-cyan-500/20 dark:from-card dark:to-cyan-950/30 dark:ring-cyan-400/10",
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "translate-y-3 scale-[0.96] opacity-0",
        )}
        aria-hidden={!open}
      >
        <div className="mb-4 flex gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500 text-white shadow-md shadow-cyan-600/25"
            aria-hidden
          >
            <Sparkles className="size-5" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold leading-tight tracking-tight text-foreground">
              Bauflip Assistent
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Hilfe zu nächstem Schritt, Pflichtfeldern und Statuswechseln.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0 rounded-xl border border-input bg-background/90 p-1 shadow-inner transition-[box-shadow] focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/35 dark:bg-input/25">
          <Input
            placeholder="Frage eingeben…"
            className="h-9 flex-1 border-0 bg-transparent px-3 shadow-none focus-visible:ring-0"
            aria-label="Frage an den Assistenten"
          />
          <Button
            type="button"
            size="icon-sm"
            className="shrink-0 rounded-lg"
            aria-label="Senden"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex size-14 items-center justify-center rounded-full bg-cyan-500 text-white shadow-lg shadow-cyan-600/30 transition-[transform,background-color,box-shadow] duration-200 hover:bg-cyan-600 hover:shadow-xl active:scale-95 motion-reduce:active:scale-100",
          open && "ring-2 ring-cyan-300 ring-offset-2 ring-offset-background dark:ring-cyan-500/60 dark:ring-offset-background",
        )}
        aria-expanded={open}
        aria-controls="bauflip-assistent-panel"
        aria-label={open ? "Assistent schließen" : "Assistent öffnen"}
      >
        {open ? <X className="size-6" strokeWidth={2} /> : <MessageCircle className="size-6" strokeWidth={2} />}
      </button>
    </div>
  );
}
