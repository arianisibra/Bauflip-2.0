/**
 * Hell/Dunkel-Steuerung über `data-theme` am <html>. Die Wahl ("light"/"dark"/"system")
 * liegt in localStorage; «system» wird zur Laufzeit zu light/dark aufgelöst. Ein
 * Pre-Paint-Skript im RootLayout setzt das Attribut identisch, bevor React lädt
 * (kein Flackern). Bewusst ohne React-State — nutzbar via useSyncExternalStore.
 */

export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

export function getThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(choice: ThemeChoice): "light" | "dark" {
  if (choice === "light" || choice === "dark") return choice;
  return systemPrefersDark() ? "dark" : "light";
}

export function applyTheme(choice: ThemeChoice): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolveTheme(choice);
}

export function setThemeChoice(choice: ThemeChoice): void {
  if (typeof window === "undefined") return;
  try {
    if (choice === "system") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* localStorage evtl. gesperrt — Theme gilt dann nur für diese Session. */
  }
  applyTheme(choice);
  window.dispatchEvent(new Event("bauflip:themechange"));
}

/** Abo für useSyncExternalStore: eigene Änderungen, andere Tabs, System-Wechsel. */
export function subscribeTheme(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (getThemeChoice() === "system") applyTheme("system");
    callback();
  };
  window.addEventListener("bauflip:themechange", callback);
  window.addEventListener("storage", callback);
  mql.addEventListener("change", onSystemChange);
  return () => {
    window.removeEventListener("bauflip:themechange", callback);
    window.removeEventListener("storage", callback);
    mql.removeEventListener("change", onSystemChange);
  };
}

/** Inline-Skript-Quelltext fürs RootLayout — setzt data-theme vor dem ersten Paint. */
export const THEME_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem('theme');var d=c==='dark'||(c!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})();`;
