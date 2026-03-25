"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type TotpFactor = {
  id: string;
  totp?: {
    uri?: string;
  };
};

export function MfaSetupForm() {
  const [factor, setFactor] = useState<TotpFactor | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function enroll() {
    setBusy(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("Supabase ist nicht konfiguriert.");
      }

      const mfaApi = (supabase.auth as { mfa?: { enroll?: (input: { factorType: "totp"; friendlyName: string }) => Promise<{ data?: TotpFactor; error?: { message?: string } }> } }).mfa;
      if (!mfaApi?.enroll) {
        throw new Error("MFA API ist nicht verfügbar.");
      }

      const { data, error: enrollError } = await mfaApi.enroll({
        factorType: "totp",
        friendlyName: "Bauflip Admin MFA",
      });
      if (enrollError || !data) {
        throw new Error(enrollError?.message ?? "MFA konnte nicht gestartet werden.");
      }

      setFactor(data);
      const uri = data.totp?.uri;
      if (uri) {
        const qr = await QRCode.toDataURL(uri);
        setQrDataUrl(qr);
      }
    } catch (enrollError) {
      setError(enrollError instanceof Error ? enrollError.message : "Unbekannter MFA-Fehler.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase || !factor?.id) {
        throw new Error("MFA-Status ungültig.");
      }

      const mfaApi = (supabase.auth as {
        mfa?: {
          challenge?: (input: { factorId: string }) => Promise<{ data?: { id: string }; error?: { message?: string } }>;
          verify?: (input: { factorId: string; challengeId: string; code: string }) => Promise<{ error?: { message?: string } }>;
        };
      }).mfa;
      if (!mfaApi?.challenge || !mfaApi?.verify) {
        throw new Error("MFA API ist nicht verfügbar.");
      }

      const { data: challenge, error: challengeError } = await mfaApi.challenge({
        factorId: factor.id,
      });
      if (challengeError || !challenge?.id) {
        throw new Error(challengeError?.message ?? "MFA Challenge fehlgeschlagen.");
      }

      const { error: verifyError } = await mfaApi.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) {
        throw new Error(verifyError.message ?? "MFA-Code ungültig.");
      }

      router.push("/");
      router.refresh();
    } catch (verifyErr) {
      setError(verifyErr instanceof Error ? verifyErr.message : "MFA-Verifikation fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Für Admin-Zugriff ist ein zweiter Faktor erforderlich. Scannen Sie den QR-Code mit einer Authenticator-App.
      </p>
      {!factor ? (
        <Button onClick={enroll} disabled={busy}>
          MFA einrichten
        </Button>
      ) : null}
      {qrDataUrl ? (
        <div className="rounded-md border bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="MFA QR Code" className="mx-auto size-56" />
        </div>
      ) : null}
      {factor ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="mfaCode">6-stelliger Code</Label>
          <Input
            id="mfaCode"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
            maxLength={6}
          />
          <Button onClick={verify} disabled={busy || code.length < 6}>
            MFA bestätigen
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
