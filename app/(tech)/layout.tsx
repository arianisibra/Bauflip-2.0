import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";

export default async function TechLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/anmeldung");
  }
  if (session.role !== "technician") {
    // Monteur-Bereich nur für Technikerrollen zugänglich.
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">{children}</main>
    </div>
  );
}

