"use client";

import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ChatbotFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed right-6 bottom-6 z-50">
      {open ? (
        <div className="mb-3 w-80 rounded-2xl border bg-background p-3 shadow-xl">
          <p className="mb-2 text-sm font-medium">Bauflip Assistent</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Hilfe zu nächstem Schritt, Pflichtfeldern und Statuswechseln.
          </p>
          <div className="flex items-center gap-2">
            <Input placeholder="Frage eingeben..." />
            <Button type="button" size="icon-sm">
              <Send />
            </Button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex size-14 items-center justify-center rounded-full bg-cyan-500 text-white shadow-lg transition hover:bg-cyan-600"
        aria-label="Chatbot öffnen"
      >
        <MessageCircle className="size-6" />
      </button>
    </div>
  );
}
