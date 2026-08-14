"use client";

import { useActionState, useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Building2, KeyRound, Mail, MailCheck, User } from "lucide-react";
import { registerOrganizationAction } from "@/app/(auth)/registrieren/actions";
import { RegisterSubmitButton } from "@/components/auth/register-submit-button";
import { TurnstileField } from "@/components/auth/turnstile-field";

const hasTurnstileSiteKey = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

/**
 * `requiresCode` steuert nur die ANZEIGE des Feldes. Die eigentliche Prüfung
 * sitzt in der Server Action — sie ist ein öffentlicher Endpunkt und lässt sich
 * ohne dieses Formular aufrufen.
 */
export function RegisterForm({ requiresCode = false }: { requiresCode?: boolean }) {
  const [state, formAction] = useActionState(registerOrganizationAction, null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const submitBlocked = hasTurnstileSiteKey && !turnstileToken;
  const handleTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token ? token : null);
  }, []);

  if (state?.confirmEmailSent) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <MailCheck className="size-10 text-primary" aria-hidden />
        <p className="text-sm text-foreground">
          Fast geschafft — wir haben Ihnen eine Bestätigungs-E-Mail geschickt.
        </p>
        <p className="text-xs text-muted-foreground">
          Klicken Sie auf den Link darin, um Ihr Konto und Ihre Organisation zu aktivieren.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}

      {requiresCode ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="registrationCode">Einladungscode</Label>
          <Input
            id="registrationCode"
            name="registrationCode"
            required
            autoComplete="off"
            placeholder="Von Ihrem Ansprechpartner erhalten"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="companyName">Firmenname</Label>
        <div className="relative">
          <Building2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="companyName"
            name="companyName"
            placeholder="Muster AG"
            required
            className="h-11 pl-10"
            autoComplete="organization"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">Ihr Name</Label>
        <div className="relative">
          <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="displayName"
            name="displayName"
            placeholder="Max Muster"
            required
            className="h-11 pl-10"
            autoComplete="name"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-Mail</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="name@firma.ch"
            required
            className="h-11 pl-10"
            autoComplete="email"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Passwort</Label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={10}
            placeholder="Mindestens 10 Zeichen"
            className="h-11 pl-10"
            autoComplete="new-password"
          />
        </div>
      </div>

      {hasTurnstileSiteKey ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">Sicherheitsprüfung</span>
          <TurnstileField onToken={handleTurnstileToken} />
        </div>
      ) : null}

      <RegisterSubmitButton disabled={submitBlocked} />
      {submitBlocked ? (
        <p className="text-center text-xs text-muted-foreground">
          Bitte kurz warten, bis die Sicherheitsprüfung abgeschlossen ist.
        </p>
      ) : null}
    </form>
  );
}
