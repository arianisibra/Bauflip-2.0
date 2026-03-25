"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Mail } from "lucide-react";
import { loginAction } from "@/app/(auth)/anmeldung/actions";
import { LoginSubmitButton } from "@/components/auth/login-submit-button";
import { TurnstileField } from "@/components/auth/turnstile-field";

const hasTurnstileSiteKey = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

export function LoginForm() {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const submitBlocked = hasTurnstileSiteKey && !turnstileToken;
  const handleTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token ? token : null);
  }, []);

  return (
    <form action={loginAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-Mail</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
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
          <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="password"
            name="password"
            type="password"
            required
            placeholder="Passwort"
            className="h-11 pl-10 pr-10"
            autoComplete="current-password"
          />
        </div>
      </div>

      {hasTurnstileSiteKey ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">Sicherheitsprüfung</span>
          <TurnstileField onToken={handleTurnstileToken} />
        </div>
      ) : null}

      <LoginSubmitButton disabled={submitBlocked} />
      {submitBlocked ? (
        <p className="text-center text-xs text-muted-foreground">
          Bitte kurz warten, bis die Sicherheitsprüfung abgeschlossen ist.
        </p>
      ) : null}
    </form>
  );
}
