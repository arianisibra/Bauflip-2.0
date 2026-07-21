"use client";

import { useSyncExternalStore } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import {
  getThemeChoice,
  setThemeChoice,
  subscribeTheme,
  type ThemeChoice,
} from "@/lib/theme/theme-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Hell", Icon: Sun },
  { value: "dark", label: "Dunkel", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/** Hell/Dunkel/System-Umschalter im Kopf. Wahl in localStorage, sofort ohne Reload. */
export function ThemeToggle() {
  const choice = useSyncExternalStore(subscribeTheme, getThemeChoice, () => "system");
  const current = OPTIONS.find((o) => o.value === choice) ?? OPTIONS[2];
  const CurrentIcon = current.Icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Darstellung: ${current.label}`}
          title={`Darstellung: ${current.label}`}
          className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CurrentIcon className="size-5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {OPTIONS.map(({ value, label, Icon }) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => setThemeChoice(value)}
            className="flex items-center gap-2"
          >
            <Icon className="size-4" aria-hidden />
            <span className="flex-1">{label}</span>
            {choice === value ? <Check className="size-4 text-primary" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
