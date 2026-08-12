"use client";

import { useLayoutEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LogOut, Moon, Sun } from "lucide-react";
import { logoutAction } from "@/app/(app)/logout-action";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 10;

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
  const [isSigningOut, startSignOut] = useTransition();
  const [isSavingPassword, startSavePassword] = useTransition();
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordDone, setPasswordDone] = useState(false);

  function handlePasswordChange(formData: FormData) {
    const password = String(formData.get("password") ?? "");
    const repeat = String(formData.get("passwordRepeat") ?? "");
    setPasswordError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`);
      return;
    }
    if (password !== repeat) {
      setPasswordError("Die beiden Passwörter stimmen nicht überein.");
      return;
    }

    startSavePassword(async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setPasswordError("Anmeldedienst ist nicht verfügbar.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setPasswordError("Passwort konnte nicht geändert werden.");
        return;
      }
      setPasswordDone(true);
    });
  }

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

      {/* Passwort ändern — vorher gab es dafür in der ganzen App keine Möglichkeit. */}
      <Card className="border-border shadow-sm">
        <CardContent className="space-y-3 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Passwort
          </p>
          {passwordDone ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
              Passwort geändert.
            </p>
          ) : (
            <form action={handlePasswordChange} className="space-y-3">
              <Input
                name="password"
                type="password"
                placeholder="Neues Passwort (mind. 10 Zeichen)"
                autoComplete="new-password"
                required
                className="h-11"
              />
              <Input
                name="passwordRepeat"
                type="password"
                placeholder="Passwort wiederholen"
                autoComplete="new-password"
                required
                className="h-11"
              />
              {passwordError ? (
                <p className="text-sm text-destructive">{passwordError}</p>
              ) : null}
              <Button type="submit" disabled={isSavingPassword} className="h-11 w-full">
                {isSavingPassword ? "Wird gespeichert …" : "Passwort ändern"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Abmelden — bis dahin gab es in der Monteur-Ansicht keinen Weg heraus. */}
      <Card className="border-border shadow-sm">
        <CardContent className="space-y-3 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Konto
          </p>
          <button
            type="button"
            disabled={isSigningOut}
            onClick={() => {
              startSignOut(async () => {
                await logoutAction();
              });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive transition-colors active:scale-[0.99] hover:bg-destructive/10 disabled:opacity-60"
          >
            <LogOut className="size-4" />
            {isSigningOut ? "Wird abgemeldet …" : "Abmelden"}
          </button>
        </CardContent>
      </Card>
    </section>
  );
}
