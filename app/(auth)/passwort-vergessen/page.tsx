import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordResetRequestForm } from "@/components/auth/password-reset-request-form";

export default function PasswortVergessenPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background to-accent/20">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -right-24 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-28 -left-20 size-72 rounded-full bg-accent/50 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
        <Link
          href="/anmeldung"
          className="mb-8 inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Zurück zur Anmeldung
        </Link>

        <div className="flex flex-1 items-center">
          <Card className="w-full border-border bg-card/90 shadow-xl shadow-black/5 backdrop-blur">
            <CardHeader className="items-center pb-4 text-center">
              <div className="mb-2 inline-flex size-20 items-center justify-center rounded-full bg-accent ring-1 ring-border">
                <Image
                  src="/Bauflip_Logo_Kurz-removebg_black.png"
                  alt="Bauflip Logo"
                  width={54}
                  height={54}
                  className="size-[54px]"
                  priority
                />
              </div>
              <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
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
