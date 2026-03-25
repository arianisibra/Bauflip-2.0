import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export default function OnboardingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Einladung abschliessen</CardTitle>
          <CardDescription>
            Setzen Sie Ihr Passwort und aktivieren Sie Ihr Konto für den Zugriff auf Ihre Organisation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm />
        </CardContent>
      </Card>
    </main>
  );
}
