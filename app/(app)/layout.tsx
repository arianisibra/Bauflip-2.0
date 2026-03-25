import { redirect } from "next/navigation";
import { ChatbotFab } from "@/components/app/chatbot-fab";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { UserAvatarButton } from "@/components/app/user-avatar-button";
import { getCurrentRole, getCurrentSession } from "@/lib/auth/session";
import { getOrganizationBranding } from "@/lib/db/repository";
import { isAdminMfaRequiredAndMissing } from "@/lib/auth/mfa";
import { getVisibleSidebarItems } from "@/lib/navigation/sidebar-config";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const role = await getCurrentRole();
  const session = await getCurrentSession();
  const branding = await getOrganizationBranding(session?.organizationId ?? null);
  const mfaMissing = await isAdminMfaRequiredAndMissing();
  if (mfaMissing) {
    redirect("/mfa/setup");
  }
  const items = getVisibleSidebarItems(role);

  return (
    <div className="h-screen overflow-hidden bg-slate-100">
      <div className="flex h-full">
        <div className="overflow-hidden">
          <SidebarNav role={role} items={items} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-end border-b bg-white px-6">
            <UserAvatarButton organizationName={branding.name} organizationLogoUrl={branding.logoUrl} />
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</main>
        </div>
      </div>
      <ChatbotFab />
    </div>
  );
}
