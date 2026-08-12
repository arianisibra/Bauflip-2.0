"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Fordert eine Passwort-Zurücksetzen-Mail an.
 *
 * Die Antwort ist bewusst immer gleich — auch wenn die Adresse unbekannt ist.
 * Sonst liesse sich über dieses Formular herausfinden, welche E-Mail-Adressen
 * ein Konto haben.
 */
export function PasswordResetRequestForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    setError(null);

    if (!email) {
      setError("Bitte E-Mail-Adresse eingeben.");
      return;
    }

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError("Anmeldedienst ist nicht verfügbar.");
        return;
      }

      // Über /auth/confirm, damit der Token in eine Session getauscht wird —
      // sonst landet man ohne Anmeldung auf der Passwort-Seite.
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${globalThis.location.origin}/auth/confirm?next=/passwort-neu`,
      });

      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-slate-700">
          Falls ein Konto mit dieser Adresse besteht, ist die E-Mail unterwegs.
        </p>
        <p className="text-xs text-slate-500">
          Bitte auch den Spam-Ordner prüfen. Der Link ist 60 Minuten gültig.
        </p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="reset-email">E-Mail</Label>
        <Input
          id="reset-email"
          name="email"
          type="email"
          placeholder="name@firma.ch"
          autoComplete="email"
          required
          className="h-11"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="h-11 w-full">
        {isPending ? (
          <BauflipLoadingButtonLabel variant="onPrimary">Wird gesendet …</BauflipLoadingButtonLabel>
        ) : (
          "Link zum Zurücksetzen senden"
        )}
      </Button>
    </form>
  );
}
