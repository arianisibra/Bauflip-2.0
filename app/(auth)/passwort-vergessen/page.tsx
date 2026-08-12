import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordResetRequestForm } from "@/components/auth/password-reset-request-form";

export default function PasswortVergessenPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 to-cyan-50/40">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -right-24 size-72 rounded-full bg-cyan-200/30 blur-3xl" />
        <div className="absolute -bottom-28 -left-20 size-72 rounded-full bg-sky-300/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
        <Link
          href="/anmeldung"
          className="mb-8 inline-flex w-fit items-center gap-2 text-sm text-slate-600 transition-colors hover:text-slate-900"
        >
          <ChevronLeft className="size-4" />
          Zurück zur Anmeldung
        </Link>

        <div className="flex flex-1 items-center">
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
                Passwort vergessen
              </CardTitle>
              <CardDescription>
                Wir senden Ihnen einen Link, mit dem Sie ein neues Passwort setzen können.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <PasswordResetRequestForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
