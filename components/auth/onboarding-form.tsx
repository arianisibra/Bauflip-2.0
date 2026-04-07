"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { acceptInviteOnboardingAction } from "@/app/(app)/einstellungen/actions";

export function OnboardingForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    const password = String(formData.get("password") ?? "");
    const displayName = String(formData.get("displayName") ?? "").trim();

    if (!password || password.length < 10) {
      setError("Bitte ein sicheres Passwort mit mindestens 10 Zeichen wählen.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase ist nicht konfiguriert.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: {
        display_name: displayName,
      },
    });
    if (updateError) {
      setError("Passwort konnte nicht gesetzt werden.");
      return;
    }

    startTransition(async () => {
      try {
        await acceptInviteOnboardingAction();
        router.push("/");
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Onboarding fehlgeschlagen.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">Ihr Name</Label>
        <Input id="displayName" name="displayName" placeholder="Max Muster" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Neues Passwort</Label>
        <Input id="password" name="password" type="password" placeholder="Mindestens 10 Zeichen" required />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? (
          <BauflipLoadingButtonLabel variant="onPrimary">Konto wird aktiviert …</BauflipLoadingButtonLabel>
        ) : (
          "Konto aktivieren"
        )}
      </Button>
    </form>
  );
}
