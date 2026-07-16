"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { contactKindLabels, type Contact } from "@/lib/domain/types";
import { Input } from "@/components/ui/input";

/**
 * Such-Picker für das Kontaktverzeichnis: Freitextsuche über Name/Firma/Ort,
 * Klick übergibt den Kontakt an `onPick` (z. B. zum Autofüllen der Projektfelder).
 * Leichtgewichtig — Dropdown hängt inline am Such-Input (kein Popover-Dependency).
 */
export function ContactPicker({
  contacts,
  onPick,
  placeholder = "Aus Kontakt übernehmen …",
}: {
  contacts: Contact[];
  onPick: (contact: Contact) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = contacts.filter((c) => c.isActive);
    const matched = q
      ? active.filter((c) =>
          [c.displayName, c.companyName, c.city, c.kundenNummer].some(
            (field) => field != null && field.toLowerCase().includes(q),
          ),
        )
      : active;
    return matched.slice(0, 50);
  }, [contacts, query]);

  const pick = (contact: Contact) => {
    onPick(contact);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative">
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
        placeholder={placeholder}
        className="h-9 pl-7 text-sm"
        aria-label="Kontakt suchen"
      />
      {open && (filtered.length > 0 || query.trim()) ? (
        <div
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          onMouseDown={(e) => e.preventDefault()}
        >
          {filtered.length === 0 ? (
            <p className="px-2 py-1.5 text-[11px] text-muted-foreground">Kein Treffer.</p>
          ) : (
            <ul>
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left hover:bg-accent"
                  >
                    <span className="text-sm">
                      {c.displayName}
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        · {contactKindLabels[c.kind]}
                      </span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {[c.companyName, [c.postalCode, c.city].filter(Boolean).join(" ")]
                        .filter(Boolean)
                        .join(" · ")}
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
