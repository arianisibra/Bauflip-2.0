import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordResetForm } from "@/components/auth/password-reset-form";

export default function PasswortNeuPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 to-cyan-50/40">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -right-24 size-72 rounded-full bg-cyan-200/30 blur-3xl" />
        <div className="absolute -bottom-28 -left-20 size-72 rounded-full bg-sky-300/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-8">
        <Card className="w-full border-sky-100 bg-white/90 shadow-xl shadow-sky-100/50 backdrop-blur">
          <CardHeader className="items-center pb-4 text-center">
            <div className="mb-2 inline-flex size-20 items-center justify-center rounded-full bg-cyan-50 ring-1 ring-cyan-100">
              <Image
                src="/Bauflip_Logo_Kurz-removebg_black.png"
                alt="Bauflip Logo"
                width={54}
                height={54}
                className="size-[54px]"
                priority
              />
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight text-slate-800">
              Neues Passwort setzen
            </CardTitle>
            <CardDescription>
              Wählen Sie ein neues Passwort für Ihr Konto.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <PasswordResetForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
