import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";

export default async function AppRootPage() {
  const session = await getCurrentSession();
  if (session?.role === "technician") {
    redirect("/tag");
  }
  redirect("/projekte");
}
