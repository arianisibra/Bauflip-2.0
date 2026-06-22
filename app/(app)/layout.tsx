import { redirect } from "next/navigation";
import { MobileContextSwitch } from "@/components/app/mobile-context-switch";
import { MobileAdminNav } from "@/components/app/mobile-admin-nav";
import { OrganizationBrandingHeader } from "@/components/app/organization-branding-header";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { getCachedSessionProfile, getLayoutSession } from "@/lib/auth/session";
import { isAdminMfaRequiredAndMissing } from "@/lib/auth/mfa";
import { getVisibleSidebarItems } from "@/lib/navigation/sidebar-config";
import { AuthenticatedRealtime } from "@/components/app/authenticated-realtime";
import { SessionProfileProvider } from "@/components/app/session-profile-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getLayoutSession();
  if (!session) {
    redirect("/anmeldung");
  }
  if (session.role !== "office" && session.role !== "admin") {
    redirect("/");
  }
  const role = session.role;
  if (role === "admin") {
    const mfaMissing = await isAdminMfaRequiredAndMissing(session);
    if (mfaMissing) {
      redirect("/mfa/setup");
    }
  }
  const items = getVisibleSidebarItems(role);
  const profile = await getCachedSessionProfile(session);

  return (
    <SessionProfileProvider value={profile}>
      <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-muted/40 dark:bg-muted/35 md:h-screen md:max-h-none">
      <AuthenticatedRealtime orgId={session.organizationId} />
      <div className="flex min-h-0 flex-1">
        <div className="hidden overflow-hidden md:block">
          <SidebarNav items={items} />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b border-border/80 bg-card/95 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-card/90 sm:px-6">
            <div className="flex items-center gap-2">
              <MobileAdminNav items={items} />
              <MobileContextSwitch />
            </div>
            <OrganizationBrandingHeader />
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-4 sm:px-6 sm:py-6">{children}</main>
        </div>
      </div>
      </div>
    </SessionProfileProvider>
  );
}
