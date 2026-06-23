"use client";

import { useSessionProfile } from "@/components/app/session-profile-provider";
import { TechCalendar } from "@/components/app/tech-calendar";

export function WochenplanPageClient() {
  const profile = useSessionProfile();

  return (
    <section className="flex flex-col gap-5 pb-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Kalender</h1>
        <p className="text-xs text-muted-foreground">
          Termine nach Tag, Woche oder Monat (Europe/Zurich).
        </p>
      </header>
      <TechCalendar isTechnicianView={profile.role === "technician"} />
    </section>
  );
}
