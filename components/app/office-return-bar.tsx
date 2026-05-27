"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sanitizeAppReturnTo } from "@/lib/navigation/app-return-to";

type OfficeReturnBarProps = {
  returnTo: string | null;
  label?: string;
};

export function OfficeReturnBar({ returnTo, label = "Zurück" }: OfficeReturnBarProps) {
  const router = useRouter();
  const href = sanitizeAppReturnTo(returnTo);

  if (!href) return null;

  return (
    <div className="mb-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 h-9 gap-1.5 px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        onClick={() => router.push(href)}
      >
        <ArrowLeft className="size-4 shrink-0" aria-hidden />
        {label}
      </Button>
    </div>
  );
}
