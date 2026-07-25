"use client";

import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import type { TextSnippet } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Auswahl-Picker für Textbausteine: Klick auf den Button öffnet eine Liste,
 * Klick auf einen Baustein fügt seinen Text ein (an bestehenden Text angehängt,
 * sonst ersetzt). Leichtgewichtig wie PriceBookPicker (kein Popover/Command-Dependency).
 */
export function TextSnippetPicker({
  snippets,
  onPick,
}: {
  snippets: TextSnippet[];
  onPick: (snippet: TextSnippet) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = snippets.filter((s) => s.isActive);
    const matched = q
      ? active.filter((s) => s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q))
      : active;
    return matched.slice(0, 50);
  }, [snippets, query]);

  const pick = (snippet: TextSnippet) => {
    onPick(snippet);
    setQuery("");
    setOpen(false);
  };

  if (snippets.length === 0) return null;

  return (
    <div className="relative inline-block">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 px-2 text-[11px]"
        onClick={() => setOpen((o) => !o)}
      >
        <FileText className="size-3.5" aria-hidden />
        Textbaustein
      </Button>
      {open ? (
        // preventDefault hält den Fokus, damit onClick vor onBlur/Toggle feuert.
        <div
          className="absolute right-0 z-50 mt-1 w-72 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Textbaustein suchen …"
            className="mb-1 h-8 text-sm"
            autoFocus
          />
          <div className="max-h-56 overflow-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-1.5 text-[11px] text-muted-foreground">Kein Treffer.</p>
            ) : (
              <ul>
                {filtered.map((snippet) => (
                  <li key={snippet.id}>
                    <button
                      type="button"
                      onClick={() => pick(snippet)}
                      className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left hover:bg-accent"
                    >
                      <span className="text-sm">{snippet.title}</span>
                      <span className="line-clamp-1 text-[11px] text-muted-foreground">{snippet.body}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
