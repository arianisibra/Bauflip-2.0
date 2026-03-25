import { getCurrentProfile } from "@/lib/auth/session";
import { inviteEmployeeAction } from "@/app/(app)/einstellungen/actions";
import { TurnstileField } from "@/components/auth/turnstile-field";
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

      {profile.role === "admin" ? (
        <div className="rounded-lg border bg-white p-4">
          <h2 className="text-lg font-medium">Mitarbeiter einladen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Neue Benutzer werden per Einladungslink onboardet und erhalten ihre Rolle beim Eintritt.
          </p>
          <form action={inviteEmployeeAction} className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="invite-email">E-Mail</Label>
              <Input id="invite-email" name="email" type="email" placeholder="name@firma.ch" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-role">Rolle</Label>
              <select
                id="invite-role"
                name="role"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="technician"
              >
                <option value="technician">Monteur</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <TurnstileField />
            </div>
            <div className="md:col-span-3">
              <Button type="submit">Einladung senden</Button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
