import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { UserAvatarButton } from "@/components/app/user-avatar-button";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrganizationBranding } from "@/lib/db/repository";
import { isAdminMfaRequiredAndMissing } from "@/lib/auth/mfa";
import { getVisibleSidebarItems } from "@/lib/navigation/sidebar-config";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  const role = session?.role ?? "office";
  const [branding, mfaMissing] = await Promise.all([
    getOrganizationBranding(session?.organizationId ?? null),
    isAdminMfaRequiredAndMissing(),
  ]);
  if (mfaMissing && role === "admin") {
    redirect("/mfa/setup");
  }
  const items = getVisibleSidebarItems(role);

  return (
    <div className="h-screen overflow-hidden bg-slate-100">
      <div className="flex h-full">
        <div className="overflow-hidden">
          <SidebarNav items={items} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-end border-b bg-white px-6">
            <UserAvatarButton organizationName={branding.name} organizationLogoUrl={branding.logoUrl} />
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
