import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";

export default function AnmeldungPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 to-cyan-50/40">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -right-24 size-72 rounded-full bg-cyan-200/30 blur-3xl" />
        <div className="absolute -bottom-28 -left-20 size-72 rounded-full bg-sky-300/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
        <Link
          href="/"
          className="mb-8 inline-flex w-fit items-center gap-2 text-sm text-slate-600 transition-colors hover:text-slate-900"
        >
          <ChevronLeft className="size-4" />
          Zurück zur Startseite
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
              <CardTitle className="text-3xl font-semibold tracking-tight text-slate-800">
                Willkommen zurück!
              </CardTitle>
              <CardDescription>
                Bitte melden Sie sich mit Ihrer E-Mail und Ihrem Passwort an.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <LoginForm />

              <div className="mt-4 text-center">
                <button type="button" className="text-sm text-slate-500 hover:text-slate-700">
                  Passwort vergessen?
                </button>
              </div>

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs tracking-wide text-slate-400">ODER</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <Button type="button" variant="outline" className="h-11 w-full">
                Mit Anmelde-Link anmelden
              </Button>

              <p className="mt-4 text-center text-xs leading-relaxed text-slate-400">
                Indem Sie auf Weiter klicken, stimmen Sie unseren{" "}
                <Link href="/agb" className="underline underline-offset-2 hover:text-slate-600">
                  Nutzungsbedingungen
                </Link>{" "}
                und unserer{" "}
                <Link href="/datenschutz" className="underline underline-offset-2 hover:text-slate-600">
                  Datenschutzerklärung
                </Link>{" "}
                zu.
              </p>
            </CardContent>
          </Card>
        </div>

      </div>
    </main>
  );
}
