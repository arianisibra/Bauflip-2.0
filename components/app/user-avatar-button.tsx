"use client";

import { UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/(app)/logout-action";

export function UserAvatarButton() {
  return (
    <form action={logoutAction}>
      <Button
        type="submit"
        variant="ghost"
        className="rounded-full p-0"
        aria-label="Abmelden"
        title="Abmelden"
      >
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-sky-100 text-sky-800">
          <UserCircle2 className="size-6" />
        </span>
      </Button>
    </form>
  );
}
