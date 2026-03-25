import { getCurrentProfile } from "@/lib/auth/session";
import { inviteEmployeeAction } from "@/app/(app)/einstellungen/actions";
import { InviteRoleSelect } from "@/components/app/invite-role-select";
import { ProfileSettingsForm } from "@/components/app/profile-settings-form";
import { TurnstileField } from "@/components/auth/turnstile-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasSupabaseConfig } from "@/lib/supabase/server";

export default async function EinstellungenPage() {
  const profile = await getCurrentProfile();
  const supabaseConfigured = hasSupabaseConfig();

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Einstellungen</h1>
        <p className="mt-1 text-sm text-muted-foreground">Profil, Kalenderdarstellung und Team-Einladungen.</p>
      </header>

      <ProfileSettingsForm profile={profile} supabaseConfigured={supabaseConfigured} />

      {profile.role === "admin" ? (
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/30 px-5 py-5 sm:px-6">
            <CardTitle className="text-lg font-semibold tracking-tight">Mitarbeiter einladen</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Neue Benutzer erhalten einen Einladungslink und werden mit der gewählten Rolle freigeschaltet.
            </CardDescription>
          </CardHeader>
          <form action={inviteEmployeeAction}>
            <CardContent className="space-y-6 px-5 py-6 sm:px-6">
              <div className="grid gap-5 sm:grid-cols-2 sm:items-end">
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="invite-email" className="text-sm font-medium">
                    E-Mail
                  </Label>
                  <Input
                    id="invite-email"
                    name="email"
                    type="email"
                    placeholder="name@firma.ch"
                    required
                    autoComplete="email"
                    className="h-10 max-w-xl"
                  />
                </div>
                <div className="flex max-w-xs flex-col gap-2">
                  <Label htmlFor="invite-role" className="text-sm font-medium">
                    Rolle
                  </Label>
                  <InviteRoleSelect />
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
                <TurnstileField />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 border-t border-border/60 bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-xs text-muted-foreground">Der eingeladene Nutzer muss die Einladung in der E-Mail bestätigen.</p>
              <Button type="submit" className="w-full min-w-[11rem] sm:w-auto">
                Einladung senden
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : null}
    </section>
  );
}
