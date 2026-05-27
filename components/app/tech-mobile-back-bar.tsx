"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sanitizeTechReturnTo } from "@/lib/navigation/tech-field-navigation";

type TechMobileBackBarProps = {
  returnTo: string | null;
  label?: string;
};

export function TechMobileBackBar({ returnTo, label = "Zurück" }: TechMobileBackBarProps) {
  const router = useRouter();
  const href = sanitizeTechReturnTo(returnTo);

  if (!href) return null;

  return (
    <div className="-mt-1 mb-3">
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
