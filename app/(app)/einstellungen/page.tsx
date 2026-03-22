import { getCurrentProfile } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function EinstellungenPage() {
  const profile = await getCurrentProfile();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>
      <div className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-medium">Profil & Firma</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="displayName">Anzeigename</Label>
            <Input id="displayName" defaultValue={profile.displayName} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" defaultValue={profile.email} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="company">Firma</Label>
            <Input id="company" defaultValue="Bauflip AG" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="avatar">Profilbild URL</Label>
            <Input id="avatar" defaultValue={profile.avatarUrl ?? ""} />
          </div>
        </div>
        <Button className="mt-4">Speichern</Button>
      </div>
    </section>
  );
}
