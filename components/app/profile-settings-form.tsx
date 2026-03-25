"use client";

import { useFormStatus } from "react-dom";
import { saveProfileSettingsAction } from "@/app/(app)/einstellungen/actions";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserProfile } from "@/lib/domain/types";
import { resolveCalendarColor } from "@/lib/calendar/team-colors";
import { cn } from "@/lib/utils";

type ProfileSettingsFormProps = {
  profile: UserProfile;
  supabaseConfigured: boolean;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="default" disabled={pending} className="min-w-[9rem]">
      {pending ? <BauflipLoadingButtonLabel variant="onPrimary">Speichern…</BauflipLoadingButtonLabel> : "Speichern"}
    </Button>
  );
}

export function ProfileSettingsForm({ profile, supabaseConfigured }: ProfileSettingsFormProps) {
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/30 px-5 py-5 sm:px-6">
        <CardTitle className="text-lg font-semibold tracking-tight">Profil &amp; Firma</CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          Anzeigename und Profilbild werden im Team angezeigt. Bilder liegen im Supabase-Storage (Bucket{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">avatars</code>).
        </CardDescription>
      </CardHeader>

      <form action={saveProfileSettingsAction} method="post" encType="multipart/form-data">
        <CardContent className="space-y-8 px-5 py-6 sm:px-6">
          <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
            {/* Avatar */}
            <aside className="flex shrink-0 flex-col items-center gap-3 lg:w-[200px] lg:items-start lg:border-r lg:border-border/50 lg:pr-8">
              <div className="relative size-28 shrink-0 overflow-hidden rounded-full border-2 border-border/80 bg-muted shadow-inner ring-2 ring-background">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center px-2 text-center text-xs leading-tight text-muted-foreground">
                    Kein Bild
                  </div>
                )}
              </div>
              {supabaseConfigured ? (
                <div className="flex w-full max-w-[220px] flex-col gap-3 lg:max-w-none">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Profilbild</span>
                    <input
                      id="avatar"
                      name="avatar"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                    />
                    <Label
                      htmlFor="avatar"
                      className={cn(
                        buttonVariants({ variant: "default", size: "sm" }),
                        "w-fit cursor-pointer border-0 shadow-sm",
                      )}
                    >
                      Datei auswählen
                    </Label>
                    <p className="text-xs leading-snug text-muted-foreground">
                      JPEG, PNG, WebP oder GIF · max. 2 MB
                    </p>
                  </div>
                  {profile.avatarUrl ? (
                    <Button
                      type="submit"
                      name="removeAvatar"
                      value="true"
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      Profilbild entfernen
                    </Button>
                  ) : null}
                </div>
              ) : (
                <p className="max-w-[14rem] text-center text-xs text-muted-foreground lg:text-left">
                  Profilbild nach Supabase-Konfiguration möglich.
                </p>
              )}
            </aside>

            {/* Felder */}
            <div className="min-w-0 flex-1 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="displayName" className="text-sm font-medium">
                    Anzeigename
                  </Label>
                  <Input id="displayName" name="displayName" defaultValue={profile.displayName} required className="h-10" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    E-Mail
                  </Label>
                  <Input id="email" name="email" type="email" defaultValue={profile.email} disabled readOnly className="h-10 bg-muted/50" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="company" className="text-sm font-medium">
                  Firma (Anzeige)
                </Label>
                <Input id="company" name="company" defaultValue="Bauflip AG" disabled readOnly className="h-10 bg-muted/50" />
                <p className="text-xs text-muted-foreground">Firmenname folgt später aus der Organisationsverwaltung.</p>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/15 p-4 sm:p-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kalender</p>
                <input type="hidden" name="calendarPosition" value={String(profile.calendarPosition)} />
                <div className="flex flex-col gap-2">
                  <Label htmlFor="calendarColor" className="text-sm font-medium">
                    Farbe in Terminleiste
                  </Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      id="calendarColor"
                      name="calendarColor"
                      type="color"
                      className="h-11 w-16 cursor-pointer rounded-lg border border-input bg-background shadow-sm"
                      defaultValue={resolveCalendarColor(profile.calendarColor, profile.id)}
                    />
                    <span className="max-w-[14rem] text-xs leading-snug text-muted-foreground">
                      In der Wochen-Terminleiste und Team-Legende erkennbar.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 border-t border-border/60 bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {supabaseConfigured ? (
            <>
              <p className="text-xs text-muted-foreground sm:max-w-md">
                Änderungen gelten für Ihre Anzeige im Team und in Terminen.
              </p>
              <SubmitButton />
            </>
          ) : (
            <p className="text-sm text-amber-800">Supabase nicht verbunden — Profil kann nicht gespeichert werden.</p>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
