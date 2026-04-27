"use client";

import { useFormStatus } from "react-dom";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { Button } from "@/components/ui/button";

export function InviteEmployeeSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="sm" disabled={pending}>
      {pending ? (
        <BauflipLoadingButtonLabel variant="onPrimary">Wird gesendet …</BauflipLoadingButtonLabel>
      ) : (
        "Einladung senden"
      )}
    </Button>
  );
}
