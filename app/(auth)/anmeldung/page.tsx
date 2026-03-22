import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AnmeldungPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <Card className="w-full">
        <CardHeader className="items-center text-center">
          <Image
            src="/Bauflip_Logo-removebg_black.png"
            alt="Bauflip Logo"
            width={160}
            height={44}
            priority
          />
          <CardTitle>Anmeldung</CardTitle>
          <CardDescription>Bitte melden Sie sich mit Ihrem Bauflip-Konto an.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" type="email" placeholder="name@firma.ch" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Passwort</Label>
            <Input id="password" type="password" />
          </div>
          <Button nativeButton={false} render={<Link href="/" />}>
            Anmelden
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
