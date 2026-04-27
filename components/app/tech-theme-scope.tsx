"use client";

import { useLayoutEffect } from "react";

const THEME_STORAGE_KEY = "bauflip_theme";

export function TechThemeScope() {
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const stored = (() => {
      try {
        return window.localStorage.getItem(THEME_STORAGE_KEY);
      } catch {
        return null;
      }
    })();
    if (stored === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    return () => {
      root.classList.remove("dark");
    };
  }, []);

  return null;
}
