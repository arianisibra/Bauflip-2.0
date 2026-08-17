"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type TotpFactor = { id: string; status: string; factor_type: string };

type MfaApi = {
  listFactors?: () => Promise<{
    data?: { totp?: TotpFactor[] } | null;
    error?: { message?: string } | null;
  }>;
  challenge?: (input: { factorId: string }) => Promise<{
    data?: { id: string } | null;
    error?: { message?: string } | null;
  }>;
  verify?: (input: { factorId: string; challengeId: string; code: string }) => Promise<{
    error?: { message?: string } | null;
  }>;
};

/**
 * Login-Zeitpunkt-Challenge für einen BEREITS eingerichteten TOTP-Faktor —
 * Gegenstück zu MfaSetupForm (die legt einen neuen Faktor an). Ohne diese
 * Seite landete ein eingerichteter Admin bei jedem Login wieder in enroll(),
 * was still einen zweiten, nutzlosen Faktor angelegt hätte.
 */
export function MfaVerifyForm() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingFactor, setLoadingFactor] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    async function loadFactor() {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) {
          setError("Supabase ist nicht konfiguriert.");
          setLoadingFactor(false);
        }
        return;
      }
      const mfaApi = (supabase.auth as unknown as { mfa?: MfaApi }).mfa;
      const { data, error: listError } = (await mfaApi?.listFactors?.()) ?? {};
      if (cancelled) return;
      const verified = data?.totp?.find((f) => f.status === "verified");
      if (listError || !verified) {
        setError(listError?.message ?? "Kein eingerichteter zweiter Faktor gefunden.");
      } else {
        setFactorId(verified.id);
      }
      setLoadingFactor(false);
    }
    void loadFactor();
    return () => {
      cancelled = true;
    };
  }, []);

  async function verify() {
    if (!factorId) return;
    setBusy(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase ist nicht konfiguriert.");
      const mfaApi = (supabase.auth as unknown as { mfa?: MfaApi }).mfa;
      if (!mfaApi?.challenge || !mfaApi?.verify) {
        throw new Error("MFA API ist nicht verfügbar.");
      }

      const { data: challenge, error: challengeError } = await mfaApi.challenge({ factorId });
      if (challengeError || !challenge?.id) {
        throw new Error(challengeError?.message ?? "MFA-Challenge fehlgeschlagen.");
      }

      const { error: verifyError } = await mfaApi.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) {
        throw new Error(verifyError.message ?? "Code ungültig.");
      }

      router.push("/");
      router.refresh();
    } catch (verifyErr) {
      setError(verifyErr instanceof Error ? verifyErr.message : "MFA-Verifikation fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  if (loadingFactor) {
    return <p className="text-sm text-muted-foreground">Wird geladen …</p>;
  }

  if (!factorId) {
    return (
      <p className="text-sm text-destructive">
        {error ?? "Kein eingerichteter zweiter Faktor gefunden."} Bitte bei Problemen den Support kontaktieren.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Bitte den 6-stelligen Code aus Ihrer Authenticator-App eingeben.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="mfaVerifyCode">6-stelliger Code</Label>
        <Input
          id="mfaVerifyCode"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="123456"
          maxLength={6}
          inputMode="numeric"
          autoFocus
        />
        <Button onClick={verify} disabled={busy || code.length < 6}>
          {busy ? <BauflipLoadingButtonLabel variant="onPrimary">Wird bestätigt …</BauflipLoadingButtonLabel> : "Bestätigen"}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
