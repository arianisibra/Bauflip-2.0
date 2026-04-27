import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { listWeekTasks } from "@/lib/db/repository";
import { currentHourSwiss } from "@/lib/date/swiss";
import { swissWeekReferenceIso } from "@/lib/date/swiss-week";
import { TechDayView } from "@/components/app/tech-day-view";

function timeOfDayGreeting(): string {
  const h = currentHourSwiss();
  if (h < 12) return "Guten Morgen";
  if (h < 17) return "Guten Tag";
  return "Guten Abend";
}

export default async function TodayPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/anmeldung");

  // UTC-noon of the Swiss Monday — stable reference for the whole week,
  // TZ-independent, shared with /wochenplan so both use the same cache entry.
  const referenceIso = swissWeekReferenceIso();
  const tasks = await listWeekTasks(new Date(referenceIso));

  return (
    <TechDayView
      initialTasks={tasks}
      referenceIso={referenceIso}
      greeting={timeOfDayGreeting()}
      displayName={session.profile.displayName}
      avatarUrl={session.profile.avatarUrl}
      isTechnicianView={session.role === "technician"}
      currentUserId={session.user.id}
    />
  );
}
