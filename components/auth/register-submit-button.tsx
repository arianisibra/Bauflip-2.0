"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";

export function RegisterSubmitButton({ disabled: disabledExternal }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || Boolean(disabledExternal)}
      className="mt-2 h-11 disabled:opacity-60"
    >
      {pending ? (
        <BauflipLoadingButtonLabel variant="onPrimary">Registrierung …</BauflipLoadingButtonLabel>
      ) : (
        "Firma registrieren"
      )}
    </Button>
  );
}
