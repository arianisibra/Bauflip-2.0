"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { logoutAction } from "@/app/(app)/logout-action";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type UserAvatarButtonProps = {
  organizationName: string;
  organizationLogoUrl?: string | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "BF";
}

export function UserAvatarButton({ organizationName, organizationLogoUrl }: UserAvatarButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex max-w-[min(100vw-8rem,280px)] items-center gap-2 rounded-lg border border-transparent px-2 py-1.5",
            "text-left text-sm font-medium text-foreground outline-none transition-colors",
            "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
          )}
          aria-label="Organisation und Konto"
        >
          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/80 bg-muted">
            {organizationLogoUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- öffentliche Logo-URL (Storage) */}
                <img src={organizationLogoUrl} alt="" className="size-full object-contain p-0.5" />
              </>
            ) : (
              <span className="select-none text-xs font-semibold tracking-tight text-muted-foreground">
                {initials(organizationName)}
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1 truncate font-bold">{organizationName}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link href="/einstellungen" className="cursor-pointer">
            <Settings className="size-4" />
            Einstellungen
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
          onSelect={(e) => {
            e.preventDefault();
            void logoutAction();
          }}
        >
          <LogOut className="size-4" />
          Abmelden
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
