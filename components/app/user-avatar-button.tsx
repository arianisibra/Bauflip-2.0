"use client";

import { UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UserAvatarButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      className="rounded-full p-0"
      aria-label="Benutzermenü öffnen"
    >
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-sky-100 text-sky-800">
        <UserCircle2 className="size-6" />
      </span>
    </Button>
  );
}
