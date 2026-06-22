import { redirect } from "next/navigation";
import { BestellformularePageClient } from "@/components/app/bestellformulare-page-client";
import { getLayoutSession } from "@/lib/auth/session";

export default async function BestellformularePage() {
  const session = await getLayoutSession();
  if (!session || session.role !== "admin") {
    redirect("/projekte");
  }
  return <BestellformularePageClient />;
}
