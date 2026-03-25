"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";

export function LoginSubmitButton({ disabled: disabledExternal }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || Boolean(disabledExternal)}
      className="mt-2 h-11 bg-slate-800 hover:bg-slate-700 disabled:opacity-60"
    >
      {pending ? (
        <BauflipLoadingButtonLabel variant="onPrimary">Anmeldung …</BauflipLoadingButtonLabel>
      ) : (
        "Anmelden"
      )}
    </Button>
  );
}
