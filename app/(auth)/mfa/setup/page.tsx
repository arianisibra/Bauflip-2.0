import { redirect } from "next/navigation";
import { MfaSetupForm } from "@/components/auth/mfa-setup-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth/session";

export default async function MfaSetupPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/anmeldung");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
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
