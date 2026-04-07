import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { TechBottomNav } from "@/components/app/tech-bottom-nav";

export default async function TechLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/anmeldung");
  }
  if (session.role !== "technician") {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-4">
        {children}
      </main>
      <TechBottomNav />
    </div>
  );
}
