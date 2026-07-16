"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { PriceBookItem } from "@/lib/domain/types";
import { Input } from "@/components/ui/input";

const chf = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });

/**
 * Such-Picker für den Preisstamm: Freitextsuche über Name/Kategorie/Artikelnummer/
 * Beschreibung, Klick fügt die Position zur Offerte/Rechnung hinzu. Leichtgewichtig
 * (kein Popover/Command-Dependency) — das Dropdown hängt inline am Such-Input.
 */
export function PriceBookPicker({
  items,
  onPick,
}: {
  items: PriceBookItem[];
  onPick: (item: PriceBookItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = items.filter((i) => i.isActive);
    const matched = q
      ? active.filter((i) =>
          [i.name, i.category, i.articleNumber, i.description].some(
            (field) => field != null && field.toLowerCase().includes(q),
          ),
        )
      : active;
    return matched.slice(0, 50);
  }, [items, query]);

  const pick = (item: PriceBookItem) => {
    onPick(item);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative w-64">
      <Search
        className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder="Aus Preisstamm suchen …"
        className="h-8 pl-7 text-sm"
        aria-label="Preisstamm durchsuchen"
      />
      {open && (filtered.length > 0 || query.trim()) ? (
        // preventDefault hält den Fokus im Input, damit onClick vor dem onBlur feuert.
        <div
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          onMouseDown={(e) => e.preventDefault()}
        >
          {filtered.length === 0 ? (
            <p className="px-2 py-1.5 text-[11px] text-muted-foreground">Kein Treffer.</p>
          ) : (
            <ul>
              {filtered.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => pick(item)}
                    className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left hover:bg-accent"
                  >
                    <span className="text-sm">
                      {item.name}
                      {item.articleNumber ? (
                        <span className="ml-1 text-[11px] text-muted-foreground">· {item.articleNumber}</span>
                      ) : null}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {item.category ? `${item.category} · ` : ""}
                      {chf.format(item.unitPrice)}
                      {item.unit ? ` / ${item.unit}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
