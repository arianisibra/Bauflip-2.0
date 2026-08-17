import { redirect } from "next/navigation";
import { MfaVerifyForm } from "@/components/auth/mfa-verify-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLayoutSession } from "@/lib/auth/session";

export default async function MfaVerifyPage() {
  const session = await getLayoutSession();
  if (!session) {
    redirect("/anmeldung");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Zweiten Faktor bestätigen</CardTitle>
          <CardDescription>
            Ihr Konto hat bereits einen zweiten Faktor eingerichtet — bitte den Code aus Ihrer Authenticator-App eingeben.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MfaVerifyForm />
        </CardContent>
      </Card>
    </main>
  );
}
