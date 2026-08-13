"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Nur same-origin-relative Ziele erlauben (kein `//host`, kein Schema). */
function safeNext(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/onboarding";
}

/**
 * Liest die von Supabase im Fragment übergebene Session, schreibt sie über den
 * Browser-Client als Cookie und leitet weiter. Ohne diesen Schritt bleibt die
 * Einladung auf halbem Weg stehen: Der Token ist verbraucht, das Konto bestätigt —
 * aber Profil und Mitgliedschaft werden nie angelegt.
 */
export function AuthHashClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const next = safeNext(searchParams.get("next"));
    const fragment = globalThis.location.hash.startsWith("#")
      ? globalThis.location.hash.slice(1)
      : "";
    const params = new URLSearchParams(fragment);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      router.replace("/anmeldung?error=invite");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      router.replace("/anmeldung?error=config");
      return;
    }

    void supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setFailed(true);
          return;
        }
        // Fragment aus der Adresszeile entfernen, damit die Tokens nicht im
        // Verlauf stehen bleiben.
        globalThis.history.replaceState(null, "", globalThis.location.pathname);
        router.replace(next);
      })
      .catch(() => setFailed(true));
  }, [router, searchParams]);

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">
          Der Link konnte nicht bestätigt werden. Bitte fordere eine neue Einladung an.
        </p>
        <a href="/anmeldung" className="text-sm underline underline-offset-2">
          Zur Anmeldung
        </a>
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground">Anmeldung wird abgeschlossen …</p>;
}
