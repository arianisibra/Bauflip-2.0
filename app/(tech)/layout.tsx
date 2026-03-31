import Link from "next/link";
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
    <div className="flex min-h-screen flex-col bg-slate-100">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-4">
        {children}
      </main>
      <nav className="sticky bottom-0 w-full border-t border-slate-200 bg-white/95 py-2 shadow-[0_-4px_10px_rgba(15,23,42,0.04)] backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-around px-4 text-xs font-medium text-slate-600">
          <Link
            href="/tag"
            className="flex flex-1 flex-col items-center gap-1 rounded-full px-2 py-1 text-slate-900"
          >
            <span className="h-1 w-1 rounded-full bg-sky-500" />
            <span>Mein Tag</span>
          </Link>
          <Link
            href="/zeiten"
            className="flex flex-1 flex-col items-center gap-1 rounded-full px-2 py-1"
          >
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>Zeiten</span>
          </Link>
          <Link
            href="/profil"
            className="flex flex-1 flex-col items-center gap-1 rounded-full px-2 py-1"
          >
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>Profil</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

