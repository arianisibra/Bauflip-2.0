import { Suspense } from "react";
import { AuthHashClient } from "@/components/auth/auth-hash-client";

/**
 * Auffangseite für den Standard-Flow von Supabase (`/auth/v1/verify`): Dort löst
 * Supabase den Token selbst ein und hängt die Session als `#access_token=…` an die
 * Ziel-URL. Fragmente erreichen den Server nie — das Umwandeln in ein Cookie muss
 * deshalb im Browser passieren.
 */
export default function AuthHashPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Anmeldung wird abgeschlossen …</p>}>
        <AuthHashClient />
      </Suspense>
    </main>
  );
}
