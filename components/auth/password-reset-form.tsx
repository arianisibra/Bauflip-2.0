"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 10;

/**
 * Setzt ein neues Passwort. Die Session stammt aus dem Zurücksetzen-Link, der
 * über /auth/confirm bereits in eine Anmeldung getauscht wurde.
 */
export function PasswordResetForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    const password = String(formData.get("password") ?? "");
    const repeat = String(formData.get("passwordRepeat") ?? "");
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Bitte ein Passwort mit mindestens ${MIN_PASSWORD_LENGTH} Zeichen wählen.`);
      return;
    }
    if (password !== repeat) {
      setError("Die beiden Passwörter stimmen nicht überein.");
      return;
    }

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError("Anmeldedienst ist nicht verfügbar.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(
          "Passwort konnte nicht gesetzt werden. Der Link ist möglicherweise abgelaufen — bitte fordern Sie einen neuen an.",
        );
        return;
      }

      router.push("/");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">Neues Passwort</Label>
        <Input
          id="new-password"
          name="password"
          type="password"
          placeholder={`Mindestens ${MIN_PASSWORD_LENGTH} Zeichen`}
          autoComplete="new-password"
          required
          className="h-11"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password-repeat">Passwort wiederholen</Label>
        <Input
          id="new-password-repeat"
          name="passwordRepeat"
          type="password"
          autoComplete="new-password"
          required
          className="h-11"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="h-11 w-full">
        {isPending ? (
          <BauflipLoadingButtonLabel variant="onPrimary">Wird gespeichert …</BauflipLoadingButtonLabel>
        ) : (
          "Passwort speichern"
        )}
      </Button>
    </form>
  );
}
