"use client";

import { useState } from "react";
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
  canEditCompanySettings: boolean;
  organizationBilling: {
    companyName: string;
    logoUrl: string | null;
  } | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="default" disabled={pending} className="min-w-[9rem]">
      {pending ? <BauflipLoadingButtonLabel variant="onPrimary">Speichern…</BauflipLoadingButtonLabel> : "Speichern"}
    </Button>
  );
}

export function ProfileSettingsForm({
  profile,
  supabaseConfigured,
  canEditCompanySettings,
  organizationBilling,
}: ProfileSettingsFormProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [companyName, setCompanyName] = useState(organizationBilling?.companyName ?? "");
  const [calendarColor, setCalendarColor] = useState(() =>
    resolveCalendarColor(profile.calendarColor, profile.id),
  );

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/30 px-5 py-5 sm:px-6">
        <CardTitle className="text-lg font-semibold tracking-tight">Profil &amp; Firma</CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          Bereiche: Mein Profil und Firmeneinstellungen (nur Admin).
        </CardDescription>
      </CardHeader>

      <form action={saveProfileSettingsAction}>
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
              <div className="rounded-xl border border-border/60 bg-muted/15 p-4 sm:p-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mein Profil</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="displayName" className="text-sm font-medium">
                    Anzeigename
                  </Label>
                  <Input
                    id="displayName"
                    name="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="h-10"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    E-Mail
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={profile.email}
                    disabled
                    readOnly
                    className="h-10 bg-muted/50"
                  />
                </div>
              </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/15 p-4 sm:p-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Firmeneinstellungen {canEditCompanySettings ? "(Admin)" : "(nur Ansicht)"}
                </p>
                <div className="mb-4 grid gap-4 md:grid-cols-[160px_1fr]">
                  <div className="flex flex-col items-start gap-2">
                    <div className="relative size-24 overflow-hidden rounded-xl border border-border/70 bg-card">
                      {organizationBilling?.logoUrl ? (
                        <img src={organizationBilling.logoUrl} alt="Firmenlogo" className="size-full object-contain p-2" />
                      ) : (
                        <div className="flex size-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
                          Kein Logo
                        </div>
                      )}
                    </div>
                    {canEditCompanySettings ? (
                      <div className="flex w-full flex-col gap-2">
                        <input
                          id="companyLogo"
                          name="companyLogo"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="sr-only"
                        />
                        <Label
                          htmlFor="companyLogo"
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "w-fit cursor-pointer border-border/70",
                          )}
                        >
                          Logo wählen
                        </Label>
                        {organizationBilling?.logoUrl ? (
                          <Button
                            type="submit"
                            name="removeCompanyLogo"
                            value="true"
                            variant="ghost"
                            size="sm"
                            className="w-fit text-red-700"
                          >
                            Logo entfernen
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-2 sm:col-span-2">
                      <Label htmlFor="companyName" className="text-sm font-medium">
                        Firmenname
                      </Label>
                      <Input
                        id="companyName"
                        name="companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="h-10"
                        disabled={!canEditCompanySettings}
                        placeholder="Firmenname"
                      />
                    </div>
                  </div>
                </div>
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
                      value={calendarColor}
                      onChange={(e) => setCalendarColor(e.target.value)}
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
