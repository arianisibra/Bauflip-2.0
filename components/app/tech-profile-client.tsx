"use client";

import { useEffect, useState } from "react";

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

export function TechProfileClient({ displayName, email }: Props) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initialTheme = stored === "dark" || stored === "light" ? stored : "light";
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

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
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Profil
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          {displayName || "Monteur"}
        </h1>
        <p className="text-xs text-slate-500">
          Deine persönlichen Angaben und Anzeige-Einstellungen.
        </p>
      </header>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Rolle</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">
            Monteur
          </span>
        </div>
        {email ? (
          <div className="flex items-center justify-between">
            <span className="text-slate-600">E-Mail</span>
            <span className="text-xs font-medium text-slate-800">{email}</span>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Anzeige
        </p>
        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center justify-between rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 active:scale-[0.99]"
        >
          <span>Dark Mode</span>
          <span
            className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 ${
              theme === "dark" ? "bg-sky-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                theme === "dark" ? "translate-x-4" : ""
              }`}
            />
          </span>
        </button>
        <p className="text-[11px] text-slate-500">
          Gilt auf diesem Gerät und Browser. Weitere Einstellungen (Sprache,
          Benachrichtigungen) können später ergänzt werden.
        </p>
      </div>
    </section>
  );
}

