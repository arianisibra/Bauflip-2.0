import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Eye, KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TurnstileField } from "@/components/auth/turnstile-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/app/(auth)/anmeldung/actions";

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
              <form action={loginAction} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="name@firma.ch"
                      required
                      className="h-11 pl-10"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Passwort</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      placeholder="Passwort"
                      className="h-11 pl-10 pr-10"
                    />
                    <Eye className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
                <Button type="submit" className="mt-2 h-11 bg-slate-800 hover:bg-slate-700">
                  Anmelden
                </Button>
                <TurnstileField />
              </form>

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
                Indem Sie auf Weiter klicken, stimmen Sie unseren Nutzungsbedingungen und unserer
                Datenschutzerklärung zu.
              </p>
            </CardContent>
          </Card>
        </div>

      </div>
    </main>
  );
}
