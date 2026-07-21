"use client";

import { InvitePreferenceToggle } from "@/components/app/invite-preference-toggle";
import { BusyCalendarSettings } from "@/components/app/busy-calendar-settings";
import { useSessionProfile } from "@/components/app/session-profile-provider";
import { TechProfileClient } from "@/components/app/tech-profile-client";

export function TechProfilPageClient() {
  const profile = useSessionProfile();

  return (
    <>
      <TechProfileClient
        displayName={profile.displayName ?? null}
        email={profile.email ?? null}
      />
      <div className="space-y-4 pb-4">
        <InvitePreferenceToggle />
        <BusyCalendarSettings />
      </div>
    </>
  );
}
