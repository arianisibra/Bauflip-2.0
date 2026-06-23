"use client";

import { useSessionProfile } from "@/components/app/session-profile-provider";
import { TechDayView } from "@/components/app/tech-day-view";
import { currentHourSwiss } from "@/lib/date/swiss";
import { swissWeekReferenceIso } from "@/lib/date/swiss-week";
import { useMemo } from "react";

function timeOfDayGreeting(): string {
  const h = currentHourSwiss();
  if (h < 12) return "Guten Morgen";
  if (h < 17) return "Guten Tag";
  return "Guten Abend";
}

export function TagPageClient() {
  const profile = useSessionProfile();
  const referenceIso = useMemo(() => swissWeekReferenceIso(), []);

  return (
    <TechDayView
      referenceIso={referenceIso}
      greeting={timeOfDayGreeting()}
      displayName={profile.displayName}
      avatarUrl={profile.avatarUrl}
      isTechnicianView={profile.role === "technician"}
      currentUserId={profile.userId}
    />
  );
}
