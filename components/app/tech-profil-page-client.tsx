"use client";

import { useSessionProfile } from "@/components/app/session-profile-provider";
import { TechProfileClient } from "@/components/app/tech-profile-client";

export function TechProfilPageClient() {
  const profile = useSessionProfile();

  return (
    <TechProfileClient
      displayName={profile.displayName ?? null}
      email={profile.email ?? null}
    />
  );
}
