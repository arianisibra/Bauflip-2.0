import { redirect } from "next/navigation";
import { MobileContextSwitch } from "@/components/app/mobile-context-switch";
import { MobileAdminNav } from "@/components/app/mobile-admin-nav";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { UserAvatarButton } from "@/components/app/user-avatar-button";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrganizationBranding } from "@/lib/db/repository";
import { isAdminMfaRequiredAndMissing } from "@/lib/auth/mfa";
import { getVisibleSidebarItems } from "@/lib/navigation/sidebar-config";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/anmeldung");
  }
  if (session.role !== "office" && session.role !== "admin") {
    redirect("/");
  }
  const role = session.role;
  const [branding, mfaMissing] = await Promise.all([
    getOrganizationBranding(session.organizationId ?? null),
    isAdminMfaRequiredAndMissing(),
  ]);
  if (mfaMissing && role === "admin") {
    redirect("/mfa/setup");
  }
  const items = getVisibleSidebarItems(role);

  return (
    <div className="h-screen overflow-hidden bg-muted/40 dark:bg-muted/35">
      <div className="flex h-full">
        <div className="hidden overflow-hidden md:block">
          <SidebarNav items={items} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
            <div className="flex items-center gap-2">
              <MobileAdminNav items={items} />
              <MobileContextSwitch />
            </div>
            <UserAvatarButton organizationName={branding.name} organizationLogoUrl={branding.logoUrl} />
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
