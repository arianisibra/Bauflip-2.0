"use client";

import { useLayoutEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Moon, Sun } from "lucide-react";

type Props = {
  displayName: string | null;
  email: string | null;
};

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "bauflip_theme";

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function initials(name: string | null): string {
  if (!name) return "M";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "M";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]!}${parts[parts.length - 1]![0]!}`.toUpperCase();
}

export function TechProfileClient({ displayName, email }: Props) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : "light";
  });

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      }
      applyTheme(next);
      return next;
    });
  }

  return (
    <section className="flex flex-col gap-5 pb-4">
      {/* Header with avatar */}
      <header className="flex items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary ring-2 ring-primary/20">
          {initials(displayName)}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground">
            {displayName || "Monteur"}
          </h1>
          <div className="mt-0.5 flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-primary/25 bg-primary/10 text-primary"
            >
              Monteur
            </Badge>
          </div>
        </div>
      </header>

      {/* Info card */}
      <Card className="border-border shadow-sm">
        <CardContent className="space-y-3 pt-4">
          {email ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">E-Mail</span>
              <span className="text-xs font-medium text-foreground">{email}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Rolle</span>
            <Badge
              variant="outline"
              className="border-primary/25 bg-primary/10 font-medium text-primary"
            >
              Monteur
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Display settings card */}
      <Card className="border-border shadow-sm">
        <CardContent className="space-y-3 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Anzeige
          </p>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm font-medium text-foreground transition-colors active:scale-[0.99] hover:bg-muted/40"
          >
            <span className="flex items-center gap-2">
              {theme === "dark" ? (
                <Moon className="size-4 text-primary" />
              ) : (
                <Sun className="size-4 text-muted-foreground" />
              )}
              Dunkelmodus
            </span>
            <span
              className={`inline-flex h-6 w-10 items-center rounded-full p-0.5 transition-colors ${
                theme === "dark" ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`size-5 rounded-full bg-card shadow-sm transition-transform ${
                  theme === "dark" ? "translate-x-4" : ""
                }`}
              />
            </span>
          </button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Gilt auf diesem Gerät und Browser. Weitere Einstellungen (Sprache,
            Benachrichtigungen) können später ergänzt werden.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
