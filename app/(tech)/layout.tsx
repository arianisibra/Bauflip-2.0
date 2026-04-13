import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { canAccessTechFieldRoutes } from "@/lib/domain/types";
import { TechBottomNav } from "@/components/app/tech-bottom-nav";

export default async function TechLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/anmeldung");
  }
  if (!canAccessTechFieldRoutes(session.role)) {
    redirect("/");
  }

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-muted/30 dark:bg-muted/35">
      <main className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain px-4 py-4">
        {children}
      </main>
      <TechBottomNav />
    </div>
  );
}
