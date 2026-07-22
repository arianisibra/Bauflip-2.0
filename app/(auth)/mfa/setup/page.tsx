import { redirect } from "next/navigation";
import { MfaSetupForm } from "@/components/auth/mfa-setup-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLayoutSession } from "@/lib/auth/session";

export default async function MfaSetupPage() {
  const session = await getLayoutSession();
  if (!session) {
    redirect("/anmeldung");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin-Sicherheit aktivieren</CardTitle>
          <CardDescription>
            Ihr Konto benötigt Multi-Faktor-Authentifizierung, bevor Admin-Bereiche genutzt werden können.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MfaSetupForm />
        </CardContent>
      </Card>
    </main>
  );
}
