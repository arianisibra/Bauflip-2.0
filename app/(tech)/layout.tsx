import { redirect } from "next/navigation";
import { MobileContextSwitch } from "@/components/app/mobile-context-switch";
import { getCachedSessionProfile, getLayoutSession } from "@/lib/auth/session";
import { canAccessTechFieldRoutes } from "@/lib/domain/types";
import { TechBottomNav } from "@/components/app/tech-bottom-nav";
import { TechThemeScope } from "@/components/app/tech-theme-scope";
import { AuthenticatedRealtime } from "@/components/app/authenticated-realtime";
import { SessionProfileProvider } from "@/components/app/session-profile-provider";
import { OfflineBanner } from "@/components/app/offline-banner";

export default async function TechLayout({ children }: { children: React.ReactNode }) {
  const session = await getLayoutSession();
  if (!session) {
    redirect("/anmeldung");
  }
  if (!canAccessTechFieldRoutes(session.role)) {
    redirect("/");
  }

  const profile = await getCachedSessionProfile(session);

  return (
    <SessionProfileProvider value={profile}>
      <>
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem("bauflip_theme")==="dark")document.documentElement.classList.add("dark");else document.documentElement.classList.remove("dark")}catch{}`,
        }}
      />
      <TechThemeScope />
      <AuthenticatedRealtime orgId={session.organizationId} />
      <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-muted/30 dark:bg-muted/35">
        <OfflineBanner />
        {session.role !== "technician" ? (
          <header className="sticky top-0 z-50 mx-auto w-full max-w-md shrink-0 bg-muted/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+1rem)] backdrop-blur-md supports-[backdrop-filter]:bg-muted/90 md:hidden">
            <MobileContextSwitch />
          </header>
        ) : null}
        <main className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain px-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pt-4">
          {children}
        </main>
        <TechBottomNav />
      </div>
      </>
    </SessionProfileProvider>
  );
}
