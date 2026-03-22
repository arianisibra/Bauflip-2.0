import { ChatbotFab } from "@/components/app/chatbot-fab";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { UserAvatarButton } from "@/components/app/user-avatar-button";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-hidden bg-slate-100">
      <div className="flex h-full">
        <div className="overflow-hidden">
          <SidebarNav />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-end border-b bg-white px-6">
            <UserAvatarButton />
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</main>
        </div>
      </div>
      <ChatbotFab />
    </div>
  );
}
